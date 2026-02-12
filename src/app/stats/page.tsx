"use client";

import { Dice5, Coins, Users, BarChart3, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { useRecentBets, useStats, formatBetForDisplay, formatStatsForDisplay } from "@/hooks/useIndexer";
import { useReadContract } from "wagmi";
import { CONTRACTS, VAULT_ABI } from "@/lib/contracts";
import { usePrice } from "@/contexts/PriceContext";

export default function StatsPage() {
  const [filter, setFilter] = useState<"all" | "wins" | "losses">("all");
  const { formatValue } = usePrice();

  // Fetch from indexer
  const { data: bets, isLoading: betsLoading } = useRecentBets(50);
  const { data: stats, isLoading: statsLoading } = useStats();

  // Fetch vault TVL from contract
  const { data: vaultTVL } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "totalAssets",
  });

  const displayStats = stats ? formatStatsForDisplay(stats) : null;
  const displayBets = bets?.map(formatBetForDisplay) || [];

  const filteredBets = displayBets.filter((bet) => {
    if (filter === "wins") return bet.result === "won";
    if (filter === "losses") return bet.result === "lost";
    return true;
  });

  const formatTVL = (tvl: bigint | undefined) => {
    if (!tvl) return "...";
    return formatValue(tvl);
  };

  return (
    <div className="min-h-screen gradient-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Statistics</h1>

        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            label="Total Volume"
            value={statsLoading ? "..." : stats ? formatValue(stats.totalVolume) : "0"}
            icon={<Coins className="w-6 h-6" />}
          />
          <StatCard
            label="Total Bets"
            value={statsLoading ? "..." : displayStats?.totalBets || "0"}
            icon={<Dice5 className="w-6 h-6" />}
          />
          <StatCard
            label="Unique Players"
            value={statsLoading ? "..." : displayStats?.uniquePlayers || "0"}
            icon={<Users className="w-6 h-6" />}
          />
          <StatCard
            label="House Profit"
            value={statsLoading ? "..." : stats ? formatValue(stats.houseProfit) : "0"}
            trend="up"
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <StatCard
            label="Vault TVL"
            value={formatTVL(vaultTVL)}
            icon={<BarChart3 className="w-6 h-6" />}
          />
          <StatCard
            label="30d APY"
            value="--"
            subValue="Coming soon"
            icon={<TrendingUp className="w-6 h-6" />}
          />
        </div>

        {/* Charts placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Volume Over Time</h3>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Chart coming soon</p>
            </div>
          </div>
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Bet Distribution</h3>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Chart coming soon</p>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="glass rounded-xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <div className="flex gap-2 flex-wrap">
              {(["all", "wins", "losses"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? "gradient-primary text-white"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {betsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading bets...</div>
            ) : filteredBets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No bets found</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-primary/20">
                    <th className="pb-3 font-medium">Bet ID</th>
                    <th className="pb-3 font-medium">Player</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Odds</th>
                    <th className="pb-3 font-medium">Result</th>
                    <th className="pb-3 font-medium">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBets.map((bet) => (
                    <tr
                      key={bet.id}
                      className="border-b border-primary/10 hover:bg-white/5"
                    >
                      <td className="py-3 text-gray-400 font-mono text-sm">
                        #{bet.id}
                      </td>
                      <td className="py-3 font-mono text-sm">{bet.player}</td>
                      <td className="py-3 text-accent font-medium">
                        {formatValue(bet.amountRaw)}
                      </td>
                      <td className="py-3 text-primary">{bet.odds}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded text-sm font-medium ${
                            bet.result === "won"
                              ? "bg-success/20 text-success"
                              : bet.result === "lost"
                              ? "bg-danger/20 text-danger"
                              : "bg-primary/20 text-primary"
                          }`}
                        >
                          {bet.result.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 font-medium">
                        {bet.result === "won" ? (
                          <span className="text-success">+{formatValue(bet.payoutRaw)}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
