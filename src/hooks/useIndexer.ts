"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import {
  getRecentBets,
  getBetsByPlayer,
  getStats,
  getVaultEvents,
  subscribeToBets,
  BetEvent,
  IndexerStats,
} from "@/lib/indexer";

const API_KEY = process.env.NEXT_PUBLIC_INDEXER_API_KEY;

export function useRecentBets(limit = 50) {
  return useQuery({
    queryKey: ["recentBets", limit],
    queryFn: () => getRecentBets(limit, API_KEY),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

export function usePlayerBets(player: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["playerBets", player, limit],
    queryFn: () => (player ? getBetsByPlayer(player, limit, API_KEY) : []),
    enabled: !!player,
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => getStats(API_KEY),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000,
  });
}

export function useVaultEvents(limit = 50) {
  return useQuery({
    queryKey: ["vaultEvents", limit],
    queryFn: () => getVaultEvents(limit, API_KEY),
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function useLiveBets() {
  const [bets, setBets] = useState<BetEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addBet = useCallback((bet: BetEvent) => {
    setBets((prev) => [bet, ...prev].slice(0, 100)); // Keep last 100
  }, []);

  useEffect(() => {
    setIsConnected(true);
    const unsubscribe = subscribeToBets(addBet, API_KEY);

    return () => {
      setIsConnected(false);
      unsubscribe();
    };
  }, [addBet]);

  return { bets, isConnected };
}

// Format helpers
export function formatBetForDisplay(bet: BetEvent): {
  id: string;
  player: string;
  amount: string;
  amountRaw: number;
  odds: string;
  result: "pending" | "won" | "lost";
  payout: string;
  payoutRaw: number;
} {
  const amountNum = Number(bet.amount) / 1e18;
  const payoutNum = bet.payout ? Number(bet.payout) / 1e18 : 0;

  // Determine result: expired counts as lost
  let result: "pending" | "won" | "lost";
  if (bet.expired) {
    result = "lost"; // expired = loss
  } else if (bet.won === undefined) {
    result = "pending";
  } else {
    result = bet.won ? "won" : "lost";
  }

  return {
    id: bet.betId,
    player: `${bet.player.slice(0, 6)}...${bet.player.slice(-4)}`,
    amount: amountNum >= 1000 ? `${(amountNum / 1000).toFixed(1)}K` : amountNum.toFixed(0),
    amountRaw: amountNum,
    odds: `${bet.odds}%`,
    result,
    payout: payoutNum >= 1000 ? `${(payoutNum / 1000).toFixed(1)}K` : payoutNum.toFixed(0),
    payoutRaw: payoutNum,
  };
}

export function formatStatsForDisplay(stats: IndexerStats): {
  totalVolume: string;
  totalBets: string;
  uniquePlayers: string;
  houseProfit: string;
} {
  const volumeNum = Number(stats.totalVolume) / 1e18;
  const profitNum = Number(stats.houseProfit) / 1e18;

  const formatLarge = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };

  return {
    totalVolume: `${formatLarge(volumeNum)} CLAW`,
    totalBets: stats.totalBets.toLocaleString(),
    uniquePlayers: stats.uniquePlayers.toLocaleString(),
    houseProfit: `${formatLarge(profitNum)} CLAW`,
  };
}
