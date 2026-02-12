"use client";

import { Sparkles } from "lucide-react";
import { useRecentBets, formatBetForDisplay } from "@/hooks/useIndexer";
import { usePrice } from "@/contexts/PriceContext";

interface DisplayBet {
  id: string;
  player: string;
  amount: string;
  amountRaw: number; // raw amount for price conversion
  odds: string;
  result: "pending" | "won" | "lost" | "expired";
  payout: string;
  payoutRaw: number; // raw payout for price conversion
}

function BetCard({ bet }: { bet: DisplayBet }) {
  const { formatValue } = usePrice();
  const isWon = bet.result === "won";
  const isLost = bet.result === "lost";
  const isExpired = bet.result === "expired";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-full whitespace-nowrap shadow-md ${
        isWon
          ? "bg-mint/30 border-2 border-mint"
          : isLost || isExpired
          ? "bg-claw/10 border-2 border-claw/30"
          : "bg-accent/20 border-2 border-accent/40"
      }`}
    >
      <Sparkles
        className={`w-4 h-4 ${
          isWon ? "text-mint-dark" : isLost || isExpired ? "text-claw" : "text-accent-dark"
        }`}
      />
      <span className="text-foreground/60 font-mono text-sm">{bet.player}</span>
      <span className="text-foreground/80">bet</span>
      <span className="font-bold text-primary-dark">{formatValue(bet.amountRaw)}</span>
      <span className="text-foreground/50">@</span>
      <span className="text-accent-dark font-semibold">{bet.odds}</span>
      <span className="text-foreground/50">→</span>
      <span
        className={`font-bold ${
          isWon ? "text-mint-dark" : isLost || isExpired ? "text-claw" : "text-foreground/50"
        }`}
      >
        {isWon
          ? `WON ${formatValue(bet.payoutRaw)} ✨`
          : isExpired
          ? "EXPIRED"
          : isLost
          ? "LOST"
          : "PENDING..."}
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
      <div className="w-full overflow-hidden bg-white/50 backdrop-blur-sm border-y border-primary/20 py-4">
        <div className="flex items-center justify-center text-foreground/50 gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {isLoading ? "Loading live bets..." : "No bets yet. Be the first! ✨"}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden bg-white/50 backdrop-blur-sm border-y border-primary/20 py-4">
      <div className="flex gap-4 animate-slide-left">
        {[...displayBets, ...displayBets].map((bet, i) => (
          <BetCard key={`${bet.id}-${i}`} bet={bet} />
        ))}
      </div>
    </div>
  );
}
