import { RelayerSDKLoader } from "./RelayerSDKLoader";
import type { FhevmInstance } from "../types";
import { JsonRpcProvider, ethers } from "ethers";

export type CreateParams = {
  provider: ethers.Eip1193Provider | string;
  chainId?: number;
};

export async function createFhevmInstance({ provider, chainId }: CreateParams): Promise<FhevmInstance> {
  // 本地链（31337）优先尝试 mock
  const isLocal = typeof provider === "string" ? provider.includes("localhost") : chainId === 31337;
  if (isLocal) {
    try {
      const rpcUrl = typeof provider === "string" ? provider : "http://localhost:8545";
      const mock = await import("./mock/fhevmMock");
      // 尝试读取节点元信息（这里直接传占位，mock 工具会用默认值）。
      const instance = await mock.fhevmMockCreateInstance({
        rpcUrl,
        chainId: 31337,
        metadata: {
          ACLAddress: "0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D",
          InputVerifierAddress: "0x901F8942346f7AB3a01F6D7613119Bca447Bb030",
          KMSVerifierAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
        },
      });
      return instance;
    } catch {}
  }

  // 生产：加载 UMD + 初始化 + 创建实例
  const loader = new RelayerSDKLoader();
  await loader.load();
  const relayerSDK = (window as any).relayerSDK;
  if (!relayerSDK.__initialized__) {
    await relayerSDK.initSDK();
    relayerSDK.__initialized__ = true;
  }
  const config = { ...relayerSDK.SepoliaConfig, network: provider };
  return await relayerSDK.createInstance(config);
}



