"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useFhevm } from "@/fhevm/useFhevm";
import { useChainConfess } from "@/hooks/useChainConfess";

export default function Page() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [account, setAccount] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"feed" | "post" | "trending" | "my">("feed");

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum as ethers.Eip1193Provider;
      setProvider(eth);
      eth.request({ method: "eth_chainId" }).then((cid) => {
        setChainId(parseInt(cid as string, 16));
      });
      eth.request({ method: "eth_requestAccounts" }).then((accounts: any) => {
        setAccount(accounts[0]);
      });
    }
  }, []);

  const { instance, status, error } = useFhevm({
    provider,
    chainId,
    initialMockChains: { 31337: "http://localhost:8545" },
  });

  const cc = useChainConfess({ instance, provider, chainId });

  const getNetworkName = () => {
    if (chainId === 11155111) return "Sepolia";
    if (chainId === 31337) return "本地";
    return chainId ? `链 ${chainId}` : "未连接";
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(168, 85, 247, 0.2)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(15, 10, 30, 0.8)",
        }}
      >
        <div className="container" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <h1 className="glow-text" style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
              💌 ChainConfess
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>
                {status === "ready" ? "✅" : status === "loading" ? "⏳" : "⚠️"} FHEVM
              </span>
              <span style={{ color: "var(--text-muted)" }}>📡 {getNetworkName()}</span>
              {account && (
                <span
                  style={{
                    background: "rgba(168, 85, 247, 0.15)",
                    padding: "6px 14px",
                    borderRadius: 16,
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                >
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ borderBottom: "1px solid rgba(168, 85, 247, 0.15)" }}>
        <div className="container" style={{ display: "flex", gap: 8, padding: "16px 24px", overflowX: "auto" }}>
          {[
            { key: "feed", icon: "💌", label: "告白墙" },
            { key: "post", icon: "✨", label: "发布" },
            { key: "trending", icon: "❤️", label: "热榜" },
            { key: "my", icon: "👤", label: "我的" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                background: activeTab === tab.key ? "rgba(168, 85, 247, 0.2)" : "transparent",
                border: activeTab === tab.key ? "1px solid rgba(168, 85, 247, 0.4)" : "1px solid transparent",
                padding: "10px 20px",
                borderRadius: 20,
                color: activeTab === tab.key ? "var(--accent-purple)" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                fontSize: 14,
                fontWeight: activeTab === tab.key ? 600 : 500,
                whiteSpace: "nowrap",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container" style={{ paddingTop: 32 }}>
        {error && (
          <div
            className="glass-card"
            style={{
              padding: 20,
              marginBottom: 24,
              borderColor: "rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
            }}
          >
            ⚠️ {String(error.message || error)}
          </div>
        )}

        {!cc.address && (
          <div className="glass-card" style={{ padding: 24, marginBottom: 24, textAlign: "center" }}>
            <p style={{ fontSize: 18, marginBottom: 12 }}>🔍 合约未部署到当前网络</p>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              请切换到 Sepolia 测试网或本地开发网络
            </p>
          </div>
        )}

        {activeTab === "feed" && (
          <section>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>💬 公开告白墙</h2>
            <cc.PublicFeed />
          </section>
        )}

        {activeTab === "post" && (
          <section>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>✨ 发布告白</h2>
            <div className="glass-card" style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
              <cc.PostForm />
            </div>
          </section>
        )}

        {activeTab === "trending" && (
          <section>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>🔥 热门告白</h2>
            <cc.TopFeed />
          </section>
        )}

        {activeTab === "my" && (
          <section>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>👤 我的告白</h2>
            <cc.MyFeed />
          </section>
        )}
      </main>
    </div>
  );
}
