export type FhevmInstance = {
  createEncryptedInput: (contract: string, user: string) => {
    add8: (v: number | bigint) => void;
    add16: (v: number | bigint) => void;
    add32: (v: number | bigint) => void;
    add64: (v: number | bigint) => void;
    addBool: (v: boolean) => void;
    encrypt: () => Promise<{ handles: string[]; inputProof: string }>;
  };
  // 生成用于 userDecrypt 的密钥对
  generateKeypair: () => { publicKey: string; privateKey: string };
  // 构建 EIP-712 结构体以签名解密授权
  createEIP712: (
    publicKey: string,
    contracts: string[],
    start: number,
    durationDays: number
  ) => { types: any; domain: any; message: any };
  userDecrypt: (
    items: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contracts: string[],
    user: string,
    start: number,
    durationDays: number
  ) => Promise<Record<string, bigint | string | boolean>>;
  decryptPublic: (contract: string, handle: string) => Promise<bigint | string | boolean>;
};


