"use client";

import { Dice5, Coins, Users, BarChart3, TrendingUp, Clock } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { formatEther } from "viem";

// Mock data - would be fetched from contract/indexer in production
const mockBets = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  player: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
  amount: BigInt(Math.floor(Math.random() * 500 + 10)) * BigInt("1000000000000000000"),
  odds: Math.floor(Math.random() * 90 + 5),
  won: Math.random() > 0.5,
  payout: BigInt(0),
  timestamp: Date.now() - i * 60000,
})).map((bet) => ({
  ...bet,
  payout: bet.won ? (bet.amount * BigInt(100)) / BigInt(bet.odds) : BigInt(0),
}));

function formatAmount(amount: bigint): string {
  const num = parseFloat(formatEther(amount));
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function StatsPage() {
  const [filter, setFilter] = useState<"all" | "wins" | "losses">("all");

  const filteredBets = mockBets.filter((bet) => {
    if (filter === "wins") return bet.won;
    if (filter === "losses") return !bet.won;
    return true;
  });

  return (
    <div className="min-h-screen gradient-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Statistics</h1>

        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            label="Total Volume"
            value="1.2M CLAW"
            icon={<Coins className="w-6 h-6" />}
          />
          <StatCard
            label="Total Bets"
            value="45,678"
            icon={<Dice5 className="w-6 h-6" />}
          />
          <StatCard
            label="Unique Players"
            value="1,234"
            icon={<Users className="w-6 h-6" />}
          />
          <StatCard
            label="House Profit"
            value="12.3K CLAW"
            subValue="+2.4% 24h"
            trend="up"
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <StatCard
            label="Vault TVL"
            value="500K CLAW"
            icon={<BarChart3 className="w-6 h-6" />}
          />
          <StatCard
            label="30d APY"
            value="8.5%"
            subValue="+0.3%"
            trend="up"
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
            <div className="flex gap-2">
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
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-primary/20">
                  <th className="pb-3 font-medium">Time</th>
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
                    <td className="py-3 text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatTime(bet.timestamp)}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-sm">{bet.player}</td>
                    <td className="py-3 text-accent font-medium">
                      {formatAmount(bet.amount)} CLAW
                    </td>
                    <td className="py-3 text-primary">{bet.odds}%</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          bet.won
                            ? "bg-success/20 text-success"
                            : "bg-danger/20 text-danger"
                        }`}
                      >
                        {bet.won ? "WON" : "LOST"}
                      </span>
                    </td>
                    <td className="py-3 font-medium">
                      {bet.won ? (
                        <span className="text-success">
                          +{formatAmount(bet.payout)} CLAW
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
