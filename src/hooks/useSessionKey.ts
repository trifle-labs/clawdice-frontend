"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSignTypedData, usePublicClient, useWriteContract } from "wagmi";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Hex,
  createClient,
  parseEther,
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

const BUNDLER_URL =
  "https://api.developer.coinbase.com/rpc/v1/base-sepolia/0ISEtlczIQo4jhaa481HDPXlK5yrmfZW";

// Storage keys (v4 = smart account as session key)
const SESSION_KEY_STORAGE = "clawdice_session_key_v4";
const SESSION_SMART_ACCOUNT_STORAGE = "clawdice_session_smart_account_v4";
const SESSION_EXPIRES_STORAGE = "clawdice_session_expires_v4";
const SESSION_PLAYER_STORAGE = "clawdice_session_player_v4";

// EIP-712 domain for Clawdice
const DOMAIN = {
  name: "Clawdice",
  version: "1",
  chainId: 84532, // Base Sepolia
  verifyingContract: CONTRACTS.baseSepolia.clawdice,
} as const;

// EIP-712 types for session creation
const SESSION_TYPES = {
  CreateSession: [
    { name: "player", type: "address" },
    { name: "sessionKey", type: "address" },
    { name: "expiresAt", type: "uint256" },
    { name: "maxBetAmount", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

interface SessionState {
  eoaPrivateKey: Hex | null; // EOA that owns the smart account
  smartAccountAddress: `0x${string}` | null; // This is the actual session key
  expiresAt: number | null;
  isActive: boolean;
  isCreating: boolean;
  error: string | null;
}

export function useSessionKey() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const [state, setState] = useState<SessionState>({
    eoaPrivateKey: null,
    smartAccountAddress: null,
    expiresAt: null,
    isActive: false,
    isCreating: false,
    error: null,
  });

  // Load session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined" || !address) return;

    console.log("[useSessionKey] Loading session from localStorage for", address);

    const storedKey = localStorage.getItem(SESSION_KEY_STORAGE);
    const storedSmartAccount = localStorage.getItem(SESSION_SMART_ACCOUNT_STORAGE);
    const storedExpires = localStorage.getItem(SESSION_EXPIRES_STORAGE);
    const storedPlayer = localStorage.getItem(SESSION_PLAYER_STORAGE);

    console.log("[useSessionKey] Stored data:", { 
      hasKey: !!storedKey, 
      smartAccount: storedSmartAccount, 
      expires: storedExpires, 
      player: storedPlayer 
    });

    if (storedKey && storedSmartAccount && storedExpires && storedPlayer) {
      const expiresAt = parseInt(storedExpires);
      const now = Math.floor(Date.now() / 1000);

      console.log("[useSessionKey] Checking validity:", { expiresAt, now, isValid: expiresAt > now, playerMatch: storedPlayer.toLowerCase() === address?.toLowerCase() });

      // Check if session is still valid and for the current user
      if (expiresAt > now && storedPlayer.toLowerCase() === address?.toLowerCase()) {
        console.log("[useSessionKey] Session valid, restoring state");
        setState((prev) => ({
          ...prev,
          eoaPrivateKey: storedKey as Hex,
          smartAccountAddress: storedSmartAccount as `0x${string}`,
          expiresAt,
          isActive: true,
        }));
      } else {
        console.log("[useSessionKey] Session invalid or expired, clearing");
        clearLocalStorage();
      }
    } else {
      console.log("[useSessionKey] No stored session found");
    }
  }, [address]);

  // Track if we just created a session (ref to avoid re-triggering useEffect)
  const justCreatedRef = useRef(false);

  // Verify session is still valid on-chain
  useEffect(() => {
    const smartAccount = state.smartAccountAddress;
    if (!smartAccount || !address || !publicClient) return;

    // Skip verification if we just created the session (we already confirmed via receipt)
    if (justCreatedRef.current) {
      console.log("[useSessionKey] Skipping verification - just created session");
      justCreatedRef.current = false;
      return;
    }

    const verifySession = async () => {
      console.log("[useSessionKey] Verifying session on-chain:", { player: address, sessionKey: smartAccount });
      try {
        // Small delay to allow RPC to sync
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const isValid = await publicClient.readContract({
          address: CONTRACTS.baseSepolia.clawdice,
          abi: CLAWDICE_ABI,
          functionName: "isSessionValid",
          args: [address, smartAccount],
        });

        console.log("[useSessionKey] On-chain verification result:", isValid);

        if (!isValid) {
          console.log("[useSessionKey] Session invalid on-chain, clearing local state");
          setState((prev) => ({ ...prev, isActive: false }));
          clearLocalStorage();
        }
      } catch (err) {
        console.error("[useSessionKey] Failed to verify session:", err);
      }
    };

    verifySession();
  }, [state.smartAccountAddress, address, publicClient]);

  const clearLocalStorage = () => {
    localStorage.removeItem(SESSION_KEY_STORAGE);
    localStorage.removeItem(SESSION_SMART_ACCOUNT_STORAGE);
    localStorage.removeItem(SESSION_EXPIRES_STORAGE);
    localStorage.removeItem(SESSION_PLAYER_STORAGE);
  };

  // Create a new session - registers the SMART ACCOUNT address as session key
  const createSession = useCallback(
    async (durationHours: number = 24, maxBetAmount: bigint = parseEther("1000")) => {
      console.log("[useSessionKey] createSession called", { durationHours, maxBetAmount: maxBetAmount.toString() });
      
      if (!address || !publicClient) {
        console.log("[useSessionKey] No address or publicClient");
        setState((prev) => ({ ...prev, error: "Wallet not connected" }));
        return false;
      }

      setState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        // Generate ephemeral EOA key (this owns the smart account)
        const privateKey = generatePrivateKey();
        const ephemeralAccount = privateKeyToAccount(privateKey);
        console.log("[useSessionKey] Generated ephemeral EOA:", ephemeralAccount.address);

        // Compute the smart account address - THIS is what we register as session key
        console.log("[useSessionKey] Computing smart account address...");
        const simpleAccount = await toSimpleSmartAccount({
          client: publicClient,
          owner: ephemeralAccount,
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        });

        const smartAccountAddress = simpleAccount.address;
        console.log("[useSessionKey] Smart account address:", smartAccountAddress);

        // Calculate expiry
        const expiresAt = BigInt(Math.floor(Date.now() / 1000) + durationHours * 3600);
        console.log("[useSessionKey] Expiry:", expiresAt.toString());

        // Get current nonce from contract
        const nonce = await publicClient.readContract({
          address: CONTRACTS.baseSepolia.clawdice,
          abi: CLAWDICE_ABI,
          functionName: "getSessionNonce",
          args: [address],
        });
        console.log("[useSessionKey] Nonce:", nonce.toString());

        // Sign EIP-712 typed data - authorizing the SMART ACCOUNT as session key
        console.log("[useSessionKey] Requesting EIP-712 signature...");
        const signature = await signTypedDataAsync({
          domain: DOMAIN,
          types: SESSION_TYPES,
          primaryType: "CreateSession",
          message: {
            player: address,
            sessionKey: smartAccountAddress, // Smart account, not EOA!
            expiresAt,
            maxBetAmount,
            nonce,
          },
        });
        console.log("[useSessionKey] Signature obtained");

        // Submit to contract
        console.log("[useSessionKey] Submitting createSession tx...");
        const txHash = await writeContractAsync({
          address: CONTRACTS.baseSepolia.clawdice,
          abi: CLAWDICE_ABI,
          functionName: "createSession",
          args: [smartAccountAddress, expiresAt, maxBetAmount, signature],
        });
        console.log("[useSessionKey] Tx submitted:", txHash);

        // Wait for confirmation
        console.log("[useSessionKey] Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("[useSessionKey] Receipt:", receipt.status);

        if (receipt.status === "success") {
          // Store in localStorage
          console.log("[useSessionKey] Tx success, storing to localStorage...");
          localStorage.setItem(SESSION_KEY_STORAGE, privateKey);
          localStorage.setItem(SESSION_SMART_ACCOUNT_STORAGE, smartAccountAddress);
          localStorage.setItem(SESSION_EXPIRES_STORAGE, expiresAt.toString());
          localStorage.setItem(SESSION_PLAYER_STORAGE, address);
          
          // Mark as just created to skip immediate re-verification (avoids RPC lag race)
          justCreatedRef.current = true;
          
          console.log("[useSessionKey] localStorage updated, setting state...");
          setState({
            eoaPrivateKey: privateKey,
            smartAccountAddress,
            expiresAt: Number(expiresAt),
            isActive: true,
            isCreating: false,
            error: null,
          });

          console.log("[useSessionKey] Session created successfully!");
          return true;
        } else {
          console.log("[useSessionKey] Tx failed with status:", receipt.status);
          throw new Error("Transaction failed");
        }
      } catch (err) {
        console.error("[useSessionKey] Failed to create session:", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to create session";
        setState((prev) => ({
          ...prev,
          isCreating: false,
          error: errorMsg.includes("user rejected") ? "Signature rejected" : errorMsg,
        }));
        return false;
      }
    },
    [address, publicClient, signTypedDataAsync, writeContractAsync]
  );

  // Place bet using session key (smart account submits, Paymaster sponsors)
  const placeBetWithSession = useCallback(
    async (amount: bigint, targetOddsE18: bigint): Promise<Hex | null> => {
      if (!state.eoaPrivateKey || !state.smartAccountAddress || !address) {
        throw new Error("No active session");
      }

      try {
        const ephemeralAccount = privateKeyToAccount(state.eoaPrivateKey);

        const rpcClient = createPublicClient({
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

        // Recreate the smart account from ephemeral signer
        const simpleAccount = await toSimpleSmartAccount({
          client: rpcClient,
          owner: ephemeralAccount,
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        });

        // Sanity check: smart account address should match what we registered
        if (simpleAccount.address.toLowerCase() !== state.smartAccountAddress.toLowerCase()) {
          throw new Error("Smart account address mismatch");
        }

        // Create smart account client with Paymaster
        const smartAccountClient = createSmartAccountClient({
          account: simpleAccount,
          chain: baseSepolia,
          bundlerTransport: http(BUNDLER_URL),
          paymaster: bundlerClient,
        });

        // Encode the placeBetWithSession call
        const callData = encodeFunctionData({
          abi: CLAWDICE_ABI,
          functionName: "placeBetWithSession",
          args: [address, amount, targetOddsE18],
        });

        // Send the sponsored transaction
        // msg.sender = smart account address = registered session key ✓
        const txHash = await smartAccountClient.sendTransaction({
          to: CONTRACTS.baseSepolia.clawdice,
          data: callData,
          value: BigInt(0),
        });

        return txHash;
      } catch (err) {
        console.error("Session bet failed:", err);
        throw err;
      }
    },
    [state.eoaPrivateKey, state.smartAccountAddress, address]
  );

  // Revoke session
  const revokeSession = useCallback(async () => {
    if (!address) return;

    try {
      await writeContractAsync({
        address: CONTRACTS.baseSepolia.clawdice,
        abi: CLAWDICE_ABI,
        functionName: "revokeSession",
      });

      clearLocalStorage();

      setState({
        eoaPrivateKey: null,
        smartAccountAddress: null,
        expiresAt: null,
        isActive: false,
        isCreating: false,
        error: null,
      });
    } catch (err) {
      console.error("Failed to revoke session:", err);
    }
  }, [address, writeContractAsync]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Time remaining
  const timeRemaining = state.expiresAt
    ? Math.max(0, state.expiresAt - Math.floor(Date.now() / 1000))
    : 0;

  return {
    // State
    sessionKey: state.smartAccountAddress, // The actual session key (smart account)
    isActive: state.isActive,
    isCreating: state.isCreating || isWritePending,
    error: state.error,
    expiresAt: state.expiresAt,
    timeRemaining,

    // Actions
    createSession,
    placeBetWithSession,
    revokeSession,
    clearError,
  };
}
