"use client";

import { useEffect, useMemo, useState } from "react";
import type { FhevmInstance } from "./types";
import { createFhevmInstance } from "./internal/fhevm";
import { ethers } from "ethers";

export function useFhevm(params: {
  provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) {
  const { provider, chainId } = params;
  const [instance, setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let abort = false;
    const run = async () => {
      if (!provider) return;
      setStatus("loading");
      setError(undefined);
      try {
        const inst = await createFhevmInstance({ provider, chainId });
        if (!abort) {
          setInstance(inst);
          setStatus("ready");
        }
      } catch (e) {
        if (!abort) {
          setError(e as Error);
          setInstance(undefined);
          setStatus("error");
        }
      }
    };
    run();
    return () => {
      abort = true;
    };
  }, [provider, chainId]);

  return { instance, status, error } as const;
}



