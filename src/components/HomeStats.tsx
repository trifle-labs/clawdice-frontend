"use client";

import { Dice5, Users, Coins, BarChart3 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useStats, formatStatsForDisplay } from "@/hooks/useIndexer";
import { useIndexedVaultTVL } from "@/hooks/useIndexedBalances";
import { formatEther } from "viem";

export function HomeStats() {
  const { data: stats, isLoading } = useStats();
  const { data: vaultTVL } = useIndexedVaultTVL();

  const displayStats = stats ? formatStatsForDisplay(stats) : null;

  const formatTVL = (tvl: bigint | undefined) => {
    if (!tvl) return "...";
    const num = Number(formatEther(tvl));
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M CLAW`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K CLAW`;
    return `${num.toFixed(0)} CLAW`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      <StatCard
        label="Total Volume"
        value={isLoading ? "..." : displayStats?.totalVolume || "0 CLAW"}
        icon={<Coins className="w-8 h-8" />}
      />
      <StatCard
        label="Total Bets"
        value={isLoading ? "..." : displayStats?.totalBets || "0"}
        icon={<Dice5 className="w-8 h-8" />}
      />
      <StatCard
        label="Unique Players"
        value={isLoading ? "..." : displayStats?.uniquePlayers || "0"}
        icon={<Users className="w-8 h-8" />}
      />
      <StatCard
        label="Vault TVL"
        value={formatTVL(vaultTVL)}
        subValue="Earn yield"
        trend="up"
        icon={<BarChart3 className="w-8 h-8" />}
        href="/app/stake"
      />
    </div>
  );
}
