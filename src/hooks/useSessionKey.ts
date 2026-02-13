"use client";

import { useState, useEffect, useCallback } from "react";
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

const SESSION_KEY_STORAGE = "clawdice_session_key_v2";
const SESSION_SMART_ACCOUNT_STORAGE = "clawdice_session_smart_account";
const SESSION_EXPIRES_STORAGE = "clawdice_session_expires_v2";
const SESSION_PLAYER_STORAGE = "clawdice_session_player_v2";

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
  sessionKeyPrivate: Hex | null;
  smartAccountAddress: `0x${string}` | null;
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
    sessionKeyPrivate: null,
    smartAccountAddress: null,
    expiresAt: null,
    isActive: false,
    isCreating: false,
    error: null,
  });

  // Load session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined" || !address) return;

    const load = async () => {
      const storedKey = localStorage.getItem(SESSION_KEY_STORAGE);
      const storedSmartAccount = localStorage.getItem(SESSION_SMART_ACCOUNT_STORAGE);
      const storedExpires = localStorage.getItem(SESSION_EXPIRES_STORAGE);
      const storedPlayer = localStorage.getItem(SESSION_PLAYER_STORAGE);

      if (storedKey && storedSmartAccount && storedExpires && storedPlayer) {
        const expiresAt = parseInt(storedExpires);
        const now = Math.floor(Date.now() / 1000);

        // Check if session is still valid and for the current user
        if (expiresAt > now && storedPlayer.toLowerCase() === address?.toLowerCase()) {
          setState((prev) => ({
            ...prev,
            sessionKeyPrivate: storedKey as Hex,
            smartAccountAddress: storedSmartAccount as `0x${string}`,
            expiresAt,
            isActive: true,
          }));
        } else {
          // Clear expired or wrong-user session
          clearLocalStorage();
        }
      }
    };

    load();
  }, [address]);

  // Verify session is still valid on-chain
  useEffect(() => {
    const smartAccount = state.smartAccountAddress;
    if (!smartAccount || !address || !publicClient) return;

    const verifySession = async () => {
      try {
        const isValid = await publicClient.readContract({
          address: CONTRACTS.baseSepolia.clawdice,
          abi: CLAWDICE_ABI,
          functionName: "isSessionValid",
          args: [address, smartAccount],
        });

        if (!isValid) {
          // Session revoked or expired on-chain
          setState((prev) => ({ ...prev, isActive: false }));
          clearLocalStorage();
        }
      } catch (err) {
        console.error("Failed to verify session:", err);
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

  // Create a new session using smart account as the session key
  const createSession = useCallback(
    async (durationHours: number = 24, maxBetAmount: bigint = parseEther("1000")) => {
      if (!address || !publicClient) {
        setState((prev) => ({ ...prev, error: "Wallet not connected" }));
        return false;
      }

      setState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        // Generate ephemeral EOA key
        const privateKey = generatePrivateKey();
        const ephemeralAccount = privateKeyToAccount(privateKey);

        // Create a smart account from the ephemeral key
        // This smart account address will be the session key
        const simpleAccount = await toSimpleSmartAccount({
          client: publicClient,
          owner: ephemeralAccount,
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        });

        const smartAccountAddress = simpleAccount.address;

        // Calculate expiry (now + duration)
        const expiresAt = BigInt(Math.floor(Date.now() / 1000) + durationHours * 3600);

        // Get current nonce from contract
        const nonce = await publicClient.readContract({
          address: CONTRACTS.baseSepolia.clawdice,
          abi: CLAWDICE_ABI,
          functionName: "getSessionNonce",
          args: [address],
        });

        // Sign EIP-712 typed data - authorizing the SMART ACCOUNT as session key
        const signature = await signTypedDataAsync({
          domain: DOMAIN,
          types: SESSION_TYPES,
          primaryType: "CreateSession",
          message: {
            player: address,
            sessionKey: smartAccountAddress, // Smart account address is the session key!
            expiresAt,
            maxBetAmount,
            nonce,
          },
        });

        // Submit to contract
        const txHash = await writeContractAsync({
          address: CONTRACTS.baseSepolia.clawdice,
          abi: CLAWDICE_ABI,
          functionName: "createSession",
          args: [smartAccountAddress, expiresAt, maxBetAmount, signature],
        });

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === "success") {
          // Store in localStorage
          localStorage.setItem(SESSION_KEY_STORAGE, privateKey);
          localStorage.setItem(SESSION_SMART_ACCOUNT_STORAGE, smartAccountAddress);
          localStorage.setItem(SESSION_EXPIRES_STORAGE, expiresAt.toString());
          localStorage.setItem(SESSION_PLAYER_STORAGE, address);

          setState({
            sessionKeyPrivate: privateKey,
            smartAccountAddress,
            expiresAt: Number(expiresAt),
            isActive: true,
            isCreating: false,
            error: null,
          });

          return true;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        console.error("Failed to create session:", err);
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

  // Place bet using session key (sponsored via Paymaster)
  const placeBetWithSession = useCallback(
    async (amount: bigint, targetOddsE18: bigint): Promise<Hex | null> => {
      if (!state.sessionKeyPrivate || !state.smartAccountAddress || !address) {
        throw new Error("No active session");
      }

      try {
        const ephemeralAccount = privateKeyToAccount(state.sessionKeyPrivate);

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
        // msg.sender will be the smart account address (which is the registered session key)
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
    [state.sessionKeyPrivate, state.smartAccountAddress, address]
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
        sessionKeyPrivate: null,
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
    sessionKey: state.smartAccountAddress,
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
