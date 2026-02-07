"use client";

import { Dice5 } from "lucide-react";
import { useRecentBets, formatBetForDisplay } from "@/hooks/useIndexer";

interface DisplayBet {
  id: string;
  player: string;
  amount: string;
  odds: string;
  result: "pending" | "won" | "lost";
  payout: string;
}

function BetCard({ bet }: { bet: DisplayBet }) {
  const isWon = bet.result === "won";
  const isLost = bet.result === "lost";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg whitespace-nowrap ${
        isWon
          ? "bg-success/10 border border-success/30"
          : isLost
          ? "bg-danger/10 border border-danger/30"
          : "bg-primary/10 border border-primary/30"
      }`}
    >
      <Dice5
        className={`w-4 h-4 ${
          isWon ? "text-success" : isLost ? "text-danger" : "text-primary"
        }`}
      />
      <span className="text-gray-400 font-mono text-sm">{bet.player}</span>
      <span className="text-white">bet</span>
      <span className="font-bold text-accent">{bet.amount} CLAW</span>
      <span className="text-gray-400">@</span>
      <span className="text-primary">{bet.odds}</span>
      <span className="text-gray-400">→</span>
      <span
        className={`font-bold ${
          isWon ? "text-success" : isLost ? "text-danger" : "text-gray-400"
        }`}
      >
        {isWon
          ? `WON ${bet.payout} CLAW`
          : isLost
          ? "LOST"
          : "PENDING"}
      </span>
    </div>
  );
}

export function LiveTicker() {
  const { data: bets, isLoading } = useRecentBets(20);

  const displayBets: DisplayBet[] = bets?.map(formatBetForDisplay) || [];

  // Show placeholder if loading or no data
  if (isLoading || displayBets.length === 0) {
    return (
      <div className="w-full overflow-hidden bg-background/50 border-y border-primary/20 py-3">
        <div className="flex items-center justify-center text-gray-500">
          {isLoading ? "Loading live bets..." : "No bets yet. Be the first!"}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden bg-background/50 border-y border-primary/20 py-3">
      <div className="flex gap-4 animate-slide-left">
        {[...displayBets, ...displayBets].map((bet, i) => (
          <BetCard key={`${bet.id}-${i}`} bet={bet} />
        ))}
      </div>
    </div>
  );
}
