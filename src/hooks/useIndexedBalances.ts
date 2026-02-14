"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getClawBalance, getClawAllowance, getVaultTVL } from "@/lib/indexer";
import { CONTRACTS } from "@/lib/contracts";

/**
 * Hook to get CLAW balance via Index Supply
 * More efficient than RPC for historical data
 */
export function useIndexedClawBalance() {
  const { address } = useAccount();

  return useQuery({
    queryKey: ["indexedClawBalance", address],
    queryFn: () => getClawBalance(address!),
    enabled: !!address,
    staleTime: 10_000, // 10 seconds
    refetchInterval: 15_000, // Refetch every 15 seconds
  });
}

/**
 * Hook to get CLAW allowance for Clawdice contract via Index Supply
 */
export function useIndexedAllowance() {
  const { address } = useAccount();
  const spender = CONTRACTS.baseSepolia.clawdice;

  return useQuery({
    queryKey: ["indexedAllowance", address, spender],
    queryFn: () => getClawAllowance(address!, spender),
    enabled: !!address,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/**
 * Hook to get Vault TVL via Index Supply
 */
export function useIndexedVaultTVL() {
  return useQuery({
    queryKey: ["indexedVaultTVL"],
    queryFn: () => getVaultTVL(),
    staleTime: 30_000, // 30 seconds (TVL changes less frequently)
    refetchInterval: 60_000, // Refetch every minute
  });
}
