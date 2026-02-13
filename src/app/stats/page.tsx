"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRecentBets, useStats, formatBetForDisplay, formatStatsForDisplay } from "@/hooks/useIndexer";
import { useReadContract } from "wagmi";
import { CONTRACTS, VAULT_ABI } from "@/lib/contracts";
import { usePrice } from "@/contexts/PriceContext";

// ENS cache
const ensCache: Record<string, string | null> = {};

function shortenAddress(address: string): string {
  if (!address || address.length < 6) return address;
  // Remove 0x, take first 2 and last 2
  const clean = address.startsWith("0x") ? address.slice(2) : address;
  return `${clean.slice(0, 2)}-${clean.slice(-2)}`.toLowerCase();
}

async function resolveENS(address: string): Promise<string | null> {
  if (ensCache[address] !== undefined) {
    return ensCache[address];
  }
  
  try {
    const res = await fetch(`https://bot.trifle.life/ens/${address}`);
    if (res.ok) {
      const data = await res.json();
      const name = data.name || null;
      ensCache[address] = name;
      return name;
    }
  } catch {
    // Ignore errors
  }
  ensCache[address] = null;
  return null;
}

type SortOption = "recent" | "biggest-win" | "biggest-loss";
type FilterOption = "all" | "wins" | "losses";

export default function StatsPage() {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("recent");
  const [ensNames, setEnsNames] = useState<Record<string, string>>({});
  const { formatValue } = usePrice();

  const { data: bets, isLoading: betsLoading } = useRecentBets(50);
  const { data: stats, isLoading: statsLoading } = useStats();

  const { data: vaultTVL } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "totalAssets",
  });

  const displayStats = stats ? formatStatsForDisplay(stats) : null;
  const displayBets = useMemo(() => bets?.map(formatBetForDisplay) || [], [bets]);

  // Resolve ENS names for all players
  useEffect(() => {
    const addresses = [...new Set(displayBets.map(b => b.player))];
    addresses.forEach(async (addr) => {
      if (!ensNames[addr]) {
        const name = await resolveENS(addr);
        if (name) {
          setEnsNames(prev => ({ ...prev, [addr]: name }));
        }
      }
    });
  }, [displayBets]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDisplayName = useCallback((address: string) => {
    return ensNames[address] || shortenAddress(address);
  }, [ensNames]);

  // Filter and sort bets
  const filteredBets = displayBets
    .filter((bet) => {
      if (filter === "wins") return bet.result === "won";
      if (filter === "losses") return bet.result === "lost";
      return true;
    })
    .sort((a, b) => {
      if (sort === "biggest-win") {
        const aWin = a.result === "won" ? a.payoutRaw : 0n;
        const bWin = b.result === "won" ? b.payoutRaw : 0n;
        return bWin > aWin ? 1 : bWin < aWin ? -1 : 0;
      }
      if (sort === "biggest-loss") {
        const aLoss = a.result === "lost" ? a.amountRaw : 0n;
        const bLoss = b.result === "lost" ? b.amountRaw : 0n;
        return bLoss > aLoss ? 1 : bLoss < aLoss ? -1 : 0;
      }
      return 0; // recent - already sorted by indexer
    });

  const formatTVL = (tvl: bigint | undefined) => {
    if (!tvl) return "...";
    return formatValue(tvl);
  };

  return (
    <div className="min-h-screen bg-kawaii py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Stats</h1>

        {/* Compact Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card-kawaii p-4">
            <p className="text-xs text-foreground/50 mb-1">Volume</p>
            <p className="text-lg font-bold">{statsLoading ? "..." : stats ? formatValue(stats.totalVolume) : "0"}</p>
          </div>
          <div className="card-kawaii p-4">
            <p className="text-xs text-foreground/50 mb-1">Bets</p>
            <p className="text-lg font-bold">{statsLoading ? "..." : displayStats?.totalBets || "0"}</p>
          </div>
          <div className="card-kawaii p-4">
            <p className="text-xs text-foreground/50 mb-1">Players</p>
            <p className="text-lg font-bold">{statsLoading ? "..." : displayStats?.uniquePlayers || "0"}</p>
          </div>
          <div className="card-kawaii p-4">
            <p className="text-xs text-foreground/50 mb-1">Vault TVL</p>
            <p className="text-lg font-bold">{formatTVL(vaultTVL)}</p>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card-kawaii p-4">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="font-semibold">Activity</h3>
            
            {/* Compact filter/sort controls */}
            <div className="flex gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterOption)}
                className="text-xs bg-white/50 border border-foreground/10 rounded-lg px-2 py-1.5"
              >
                <option value="all">All</option>
                <option value="wins">Wins</option>
                <option value="losses">Losses</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="text-xs bg-white/50 border border-foreground/10 rounded-lg px-2 py-1.5"
              >
                <option value="recent">Recent</option>
                <option value="biggest-win">Top Wins</option>
                <option value="biggest-loss">Top Losses</option>
              </select>
            </div>
          </div>

          {betsLoading ? (
            <div className="text-center py-8 text-foreground/50">Loading...</div>
          ) : filteredBets.length === 0 ? (
            <div className="text-center py-8 text-foreground/50">No bets found</div>
          ) : (
            <div className="space-y-2">
              {filteredBets.map((bet) => (
                <div
                  key={bet.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    bet.result === "won" 
                      ? "bg-[#A8E6CF]/20" 
                      : bet.result === "lost"
                      ? "bg-[#E879A0]/20"
                      : "bg-white/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      bet.result === "won" ? "bg-[#7DD4B0]" : 
                      bet.result === "lost" ? "bg-[#E879A0]" : "bg-foreground/30"
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {getDisplayName(bet.player)}
                      </p>
                      <p className="text-xs text-foreground/50">
                        {bet.odds} odds • #{bet.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`font-bold text-sm ${
                      bet.result === "won" ? "text-[#7DD4B0]" : 
                      bet.result === "lost" ? "text-[#E879A0]" : ""
                    }`}>
                      {bet.result === "won" 
                        ? `+${formatValue(bet.payoutRaw)}`
                        : bet.result === "lost"
                        ? `-${formatValue(bet.amountRaw)}`
                        : formatValue(bet.amountRaw)
                      }
                    </p>
                    <p className="text-xs text-foreground/50 uppercase">
                      {bet.result}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
