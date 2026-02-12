"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  createPublicClient, 
  http, 
  encodeFunctionData, 
  type Hex,
  createClient,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { 
  bundlerActions, 
  paymasterActions,
  entryPoint07Address,
} from "viem/account-abstraction";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";
import { CONTRACTS, CLAWDICE_ABI } from "@/lib/contracts";

const BUNDLER_URL = "https://api.developer.coinbase.com/rpc/v1/base-sepolia/0ISEtlczIQo4jhaa481HDPXlK5yrmfZW";

// Local storage key for ephemeral signer
const EPHEMERAL_KEY_STORAGE = "clawdice_ephemeral_key";

function getOrCreateEphemeralKey(): Hex {
  if (typeof window === "undefined") return generatePrivateKey();
  
  const stored = localStorage.getItem(EPHEMERAL_KEY_STORAGE);
  if (stored && stored.startsWith("0x") && stored.length === 66) {
    return stored as Hex;
  }
  
  const newKey = generatePrivateKey();
  localStorage.setItem(EPHEMERAL_KEY_STORAGE, newKey);
  return newKey;
}

export function useSponsoredClaim() {
  const [isReady, setIsReady] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize on mount
    if (typeof window !== "undefined") {
      getOrCreateEphemeralKey();
      setIsReady(true);
    }
  }, []);

  const sponsoredClaim = useCallback(async (betId: bigint): Promise<Hex | null> => {
    setIsClaiming(true);
    setError(null);

    try {
      const ephemeralKey = getOrCreateEphemeralKey();
      const ephemeralAccount = privateKeyToAccount(ephemeralKey);

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Create bundler client with paymaster actions
      const bundlerClient = createClient({
        chain: baseSepolia,
        transport: http(BUNDLER_URL),
      })
        .extend(bundlerActions)
        .extend(paymasterActions);

      // Create smart account from ephemeral signer
      const simpleAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ephemeralAccount,
        entryPoint: {
          address: entryPoint07Address,
          version: "0.7",
        },
      });

      // Create smart account client
      const smartAccountClient = createSmartAccountClient({
        account: simpleAccount,
        chain: baseSepolia,
        bundlerTransport: http(BUNDLER_URL),
        // Coinbase paymaster sponsors via policy - no explicit middleware needed
        paymaster: bundlerClient,
      });

      // Encode the claim call
      const callData = encodeFunctionData({
        abi: CLAWDICE_ABI,
        functionName: "claim",
        args: [betId],
      });

      // Send the sponsored transaction
      const txHash = await smartAccountClient.sendTransaction({
        to: CONTRACTS.baseSepolia.clawdice,
        data: callData,
        value: BigInt(0),
      });

      setIsClaiming(false);
      return txHash;
    } catch (err) {
      console.error("Sponsored claim failed:", err);
      setError(err instanceof Error ? err.message : "Sponsored claim failed");
      setIsClaiming(false);
      return null;
    }
  }, []);

  return {
    isReady,
    isClaiming,
    error,
    sponsoredClaim,
  };
}
