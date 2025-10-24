"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import type { FhevmInstance } from "@/fhevm/types";
import abiJson from "../abi/ChainConfessABI.json";
import addressesJson from "../abi/ChainConfessAddresses.json";

type HookParams = {
  instance: FhevmInstance | undefined;
  provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
};

// 根据地址生成匿名头像
function generateAvatar(address: string) {
  const colors = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  ];
  const idx = parseInt(address.slice(2, 4), 16) % colors.length;
  const initial = address.slice(2, 4).toUpperCase();
  return { background: colors[idx], initial };
}

export function useChainConfess({ instance, provider, chainId }: HookParams) {
  const [ethersProvider, setEthersProvider] = useState<ethers.BrowserProvider | undefined>(undefined);
  const [signer, setSigner] = useState<ethers.Signer | undefined>(undefined);
  const [address, setAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!provider) return;
    const p = new ethers.BrowserProvider(provider);
    setEthersProvider(p);
    p.send("eth_requestAccounts", [])
      .then(async () => {
        const s = await p.getSigner();
        setSigner(s);
        setAddress(await s.getAddress());
      })
      .catch(() => {});
  }, [provider]);

  const ccAddress: string | undefined = useMemo(() => {
    if (!chainId) return undefined;
    const m = addressesJson as Record<string, { address: string }>;
    return m[String(chainId)]?.address;
  }, [chainId]);

  const contract = useMemo(() => {
    if (!ccAddress || !ethersProvider) return undefined;
    return new ethers.Contract(ccAddress, (abiJson as any).abi, signer ?? ethersProvider);
  }, [ccAddress, ethersProvider, signer]);

  const [publids, setPublIds] = useState<number[]>([]);

  const refreshPublic = useCallback(async () => {
    if (!contract) {
      setPublIds([]);
      return;
    }
    try {
      const ids: bigint[] = await contract.getAllPublicConfessions();
      setPublIds(ids.map((b) => Number(b)));
    } catch (e) {
      console.error("Failed to fetch public confessions:", e);
      setPublIds([]);
    }
  }, [contract]);

  useEffect(() => {
    refreshPublic();
  }, [refreshPublic]);

  const PostForm = useCallback(() => {
    const [message, setMessage] = useState("");
    const [receiver, setReceiver] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState("");
    const canSend = Boolean(
      instance && contract && signer && address && message.length > 0 && message.length <= 200
    );

    const onSubmit = async () => {
      if (!instance || !contract || !signer || !address) return;
      setSending(true);
      setStatus("🔐 正在加密...");
      try {
        const msgBytes = new TextEncoder().encode(message);
        const enc = instance.createEncryptedInput(contract.target as string, address);
        enc.addBool(isPublic);
        const res = await enc.encrypt();
        const rx = receiver && receiver.length === 42 ? receiver : ethers.ZeroAddress;
        setStatus("📤 正在上链...");
        const tx = await (contract as any).postConfession(msgBytes, rx, res.handles[0], res.inputProof);
        setStatus("⏳ 等待确认...");
        await tx.wait();
        setStatus("✅ 发布成功！");
        setMessage("");
        setReceiver("");
        setIsPublic(true);
        refreshPublic();
        setTimeout(() => setStatus(""), 3000);
      } catch (e: any) {
        setStatus("❌ 发布失败: " + (e.message || e));
      } finally {
        setSending(false);
      }
    };

    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            💬 告白内容
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="写下你的告白，最多 200 字..."
            maxLength={200}
            style={{ fontFamily: "inherit" }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
            {message.length} / 200
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <label htmlFor="isPublic" style={{ cursor: "pointer", fontSize: 14 }}>
            📢 公开展示（取消勾选为私密告白）
          </label>
        </div>

        {!isPublic && (
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              🎯 指定接收者地址
            </label>
            <input
              type="text"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder="0x..."
            />
          </div>
        )}

        {status && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: status.includes("❌")
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(168, 85, 247, 0.15)",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {status}
          </div>
        )}

        <button className="btn-primary" disabled={!canSend || sending} onClick={onSubmit}>
          {sending ? "上链中..." : "🚀 上链发布"}
        </button>
      </div>
    );
  }, [instance, contract, signer, address, refreshPublic]);

  const like = useCallback(
    async (id: number): Promise<"ok" | "already" | "failed"> => {
      if (!contract || !signer) return "failed";
      try {
        const tx = await (contract as any).likeConfession(id);
        await tx.wait();
        refreshPublic();
        return "ok";
      } catch (e: any) {
        const msg = String(e?.reason || e?.message || e);
        // 重复点赞：不弹系统 alert，用 UI 轻提示
        if (msg.includes("Already liked")) {
          return "already";
        }
        alert("点赞失败: " + msg);
        return "failed";
      }
    },
    [contract, signer, refreshPublic]
  );

  const Card = useCallback(
    (props: { id: number }) => {
      const [meta, setMeta] = useState<any | undefined>(undefined);
      const [decryptedLikes, setDecryptedLikes] = useState<string | undefined>(undefined);
      const [liking, setLiking] = useState(false);
      const [liked, setLiked] = useState(false);
      const [likeTip, setLikeTip] = useState<string | undefined>(undefined);
      const [heartPop, setHeartPop] = useState(false);
      const [unlocking, setUnlocking] = useState(false);
      const [unlocked, setUnlocked] = useState(false);
      const [decrypting, setDecrypting] = useState(false);

      useEffect(() => {
        (async () => {
          if (!contract) return;
          try {
            const r = await contract.getConfession(props.id);
            setMeta(r);
          } catch {}
        })();
      }, [props.id]);

      useEffect(() => {
        (async () => {
          if (!meta || !instance || !ccAddress) return;
          try {
            const handle = meta[5] as string; // euint32 likes handle
            const receiverAddr = meta[3] as string;

            // 公开帖：进入时自动解密
            if (receiverAddr === ethers.ZeroAddress) {
              const clear = await instance.decryptPublic(ccAddress, handle);
              setDecryptedLikes(String(clear));
            }
          } catch {}
        })();
      }, [meta]);

      const decryptLikes = useCallback(async () => {
        if (!meta || !instance || !ccAddress) return;
        const handle = meta[5] as string;
        const receiverAddr = meta[3] as string;
        const senderAddrLocal = meta[1] as string;
        const isPrivate = receiverAddr !== ethers.ZeroAddress;
        if (!isPrivate) return; // 私密帖才需要手动解密
        const isReceiver = address && receiverAddr.toLowerCase() === (address as string).toLowerCase();
        const isSender = address && senderAddrLocal.toLowerCase() === (address as string).toLowerCase();
        if (!isReceiver && !isSender) return;
        if (!signer) return;
        setDecrypting(true);
        try {
          const startTs = Math.floor(Date.now() / 1000);
          const durationDays = 365;
          const { publicKey, privateKey } = instance.generateKeypair();
          const eip712 = instance.createEIP712(publicKey, [ccAddress], startTs, durationDays);
          const signature = await signer.signTypedData(
            eip712.domain,
            { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
            eip712.message
          );
          const result = await instance.userDecrypt(
            [{ handle, contractAddress: ccAddress }],
            privateKey,
            publicKey,
            signature,
            [ccAddress],
            address as string,
            startTs,
            durationDays
          );
          const val = result[handle as string];
          if (typeof val === "bigint" || typeof val === "number" || typeof val === "string") {
            setDecryptedLikes(String(val));
          }
        } catch (e: any) {
          alert("解密失败: " + (e?.message || e));
        } finally {
          setDecrypting(false);
        }
      }, [meta, address, signer, instance, ccAddress]);

      if (!meta)
        return (
          <div className="glass-card" style={{ padding: 24, textAlign: "center" }}>
            <div className="loading"></div>
          </div>
        );

      const encMsgHex: string = meta[2] as string; // bytes from solidity -> hex string
      let text = "";
      try {
        const bytes = ethers.getBytes(encMsgHex);
        text = new TextDecoder().decode(bytes);
      } catch {
        text = "[无法解析的消息内容]";
      }
      const senderAddr = meta[1] as string;
      const receiver = meta[3] as string;
      const ts = Number(meta[4]);
      const date = new Date(ts * 1000);
      const timeStr = date.toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const avatar = generateAvatar(senderAddr);

      const handleLike = async () => {
        if (liking || liked) return;
        setLiking(true);
        setHeartPop(false);
        const res = await like(props.id);
        if (res === "ok") {
          setLiked(true);
          setHeartPop(true);
          setLikeTip("已点赞");
          // 重新拉取该卡片元信息，刷新解密后的点赞数
          try {
            if (contract) {
              const r = await contract.getConfession(props.id);
              setMeta(r);
            }
          } catch {}
        } else if (res === "already") {
          setLiked(true);
          setLikeTip("你已经点过赞");
        }
        setTimeout(() => setLikeTip(undefined), 2000);
        setLiking(false);
      };

      const canUnlock = receiver !== ethers.ZeroAddress && address && receiver.toLowerCase() === (address as string).toLowerCase();
      const canDecrypt = receiver !== ethers.ZeroAddress && address && (
        receiver.toLowerCase() === (address as string).toLowerCase() ||
        senderAddr.toLowerCase() === (address as string).toLowerCase()
      );

      const isPrivate = receiver !== ethers.ZeroAddress;
      const isReceiver = address && receiver.toLowerCase() === (address as string).toLowerCase();
      const canViewMessage = !isPrivate || (Boolean(isReceiver) && unlocked);

      return (
        <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div className="avatar" style={{ background: avatar.background }}>
              {avatar.initial}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>匿名用户</span>
                {receiver === ethers.ZeroAddress ? (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 10px",
                      borderRadius: 12,
                      background: "rgba(168, 85, 247, 0.15)",
                      color: "var(--accent-purple)",
                    }}
                  >
                    💬 公开
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 10px",
                      borderRadius: 12,
                      background: "rgba(236, 72, 153, 0.15)",
                      color: "var(--accent-pink)",
                    }}
                  >
                    🔒 私密
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{timeStr}</div>
            </div>
          </div>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              marginBottom: 16,
              padding: 16,
              background: "rgba(168, 85, 247, 0.05)",
              borderRadius: 12,
              borderLeft: "3px solid var(--accent-purple)",
            }}
          >
            {canViewMessage ? text : "🔒 私密内容，解锁后可见"}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <button
              className={`btn-secondary ${liked ? "like-active" : ""} ${heartPop ? "heart-pop" : ""}`}
              onClick={handleLike}
              disabled={liking || liked}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {liked ? "💖" : "❤️"} <span>{decryptedLikes ?? "..."}</span>
            </button>
            {likeTip && (
              <span style={{ fontSize: 13, color: "var(--accent-pink)" }}>{likeTip}</span>
            )}
            {canDecrypt && !decryptedLikes && (
              <button
                className="btn-secondary"
                onClick={decryptLikes}
                disabled={decrypting}
              >
                {decrypting ? "解密中..." : "🔍 解密"}
              </button>
            )}
            {canUnlock && !unlocked && (
              <button
                className="btn-secondary"
                onClick={async () => {
                  if (!contract || !signer) return;
                  try {
                    setUnlocking(true);
                    const tx = await (contract as any).unlockConfession(props.id);
                    await tx.wait();
                    setUnlocked(true);
                  } catch (e: any) {
                    alert("解锁失败: " + (e.message || e));
                  } finally {
                    setUnlocking(false);
                  }
                }}
                disabled={unlocking}
              >
                {unlocking ? "解锁中..." : "🔓 解锁"}
              </button>
            )}
            {canUnlock && unlocked && (
              <span style={{ fontSize: 13, color: "#22c55e" }}>✅ 已解锁</span>
            )}
            {receiver !== ethers.ZeroAddress && (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                → {receiver.slice(0, 6)}...{receiver.slice(-4)}
              </span>
            )}
          </div>
        </div>
      );
    },
    [contract, instance, ccAddress, like, address, signer]
  );

  const PublicFeed = useCallback(() => {
    if (publids.length === 0) {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <p style={{ fontSize: 16, color: "var(--text-muted)" }}>暂无公开告白</p>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
            成为第一个发布告白的人吧！
          </p>
        </div>
      );
    }

    return (
      <div>
        {publids.map((id) => (
          <Card key={id} id={id} />
        ))}
      </div>
    );
  }, [publids, Card]);

  const MyFeed = useCallback(() => {
    const [ids, setIds] = useState<number[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
      (async () => {
        if (!contract || !address) {
          setIds([]);
          setLoading(false);
          return;
        }
        try {
          const res: bigint[] = await (contract as any).getMyConfessions(address);
          setIds(res.map((b: bigint) => Number(b)));
        } catch (e) {
          setIds([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [contract, address]);

    if (!address) {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>请先连接钱包</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
          <div className="loading" />
        </div>
      );
    }

    if (ids.length === 0) {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>还没有与你相关的告白</p>
        </div>
      );
    }

    return (
      <div>
        {ids.map((id) => (
          <Card key={id} id={id} />
        ))}
      </div>
    );
  }, [contract, address, Card]);

  const TopFeed = useCallback((props: { limit?: number } = {}) => {
    const { limit = 10 } = props;
    const [ids, setIds] = useState<number[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
      (async () => {
        if (!contract) {
          setIds([]);
          setLoading(false);
          return;
        }
        try {
          const res: bigint[] = await (contract as any).getTopConfessions(limit);
          setIds(res.map((b: bigint) => Number(b)));
        } catch {
          setIds([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [contract, limit]);

    if (loading) {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
          <div className="loading" />
        </div>
      );
    }

    if (ids.length === 0) {
      return (
        <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>暂时没有热门告白</p>
        </div>
      );
    }

    return (
      <div>
        {ids.map((id) => (
          <Card key={id} id={id} />
        ))}
      </div>
    );
  }, [contract, Card]);

  return {
    address: ccAddress,
    refreshPublic,
    PostForm,
    PublicFeed,
    MyFeed,
    TopFeed,
  } as const;
}
