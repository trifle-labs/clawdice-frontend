"use client";

import { useEffect, useState } from "react";
import { Dice5 } from "lucide-react";
import { formatEther } from "viem";

interface BetEvent {
  id: string;
  player: string;
  amount: bigint;
  odds: number;
  won: boolean;
  payout: bigint;
  timestamp: number;
}

// Mock data for demo - would be replaced with real WebSocket/events
const mockBets: BetEvent[] = [
  {
    id: "1",
    player: "0x1234...5678",
    amount: BigInt("100000000000000000000"),
    odds: 50,
    won: true,
    payout: BigInt("200000000000000000000"),
    timestamp: Date.now() - 5000,
  },
  {
    id: "2",
    player: "0xabcd...ef01",
    amount: BigInt("50000000000000000000"),
    odds: 25,
    won: false,
    payout: BigInt("0"),
    timestamp: Date.now() - 10000,
  },
  {
    id: "3",
    player: "0x9876...5432",
    amount: BigInt("200000000000000000000"),
    odds: 75,
    won: true,
    payout: BigInt("266000000000000000000"),
    timestamp: Date.now() - 15000,
  },
  {
    id: "4",
    player: "0xfedc...ba98",
    amount: BigInt("75000000000000000000"),
    odds: 10,
    won: true,
    payout: BigInt("750000000000000000000"),
    timestamp: Date.now() - 20000,
  },
  {
    id: "5",
    player: "0x2468...1357",
    amount: BigInt("150000000000000000000"),
    odds: 50,
    won: false,
    payout: BigInt("0"),
    timestamp: Date.now() - 25000,
  },
];

function formatAmount(amount: bigint): string {
  const num = parseFloat(formatEther(amount));
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

function BetCard({ bet }: { bet: BetEvent }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg whitespace-nowrap ${
        bet.won ? "bg-success/10 border border-success/30" : "bg-danger/10 border border-danger/30"
      }`}
    >
      <Dice5 className={`w-4 h-4 ${bet.won ? "text-success" : "text-danger"}`} />
      <span className="text-gray-400 font-mono text-sm">{bet.player}</span>
      <span className="text-white">bet</span>
      <span className="font-bold text-accent">{formatAmount(bet.amount)} CLAW</span>
      <span className="text-gray-400">@</span>
      <span className="text-primary">{bet.odds}%</span>
      <span className="text-gray-400">→</span>
      <span className={`font-bold ${bet.won ? "text-success" : "text-danger"}`}>
        {bet.won ? `WON ${formatAmount(bet.payout)} CLAW` : "LOST"}
      </span>
    </div>
  );
}

export function LiveTicker() {
  const [bets, setBets] = useState<BetEvent[]>(mockBets);

  // In production, this would connect to WebSocket for live events
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new bet coming in
      const newBet: BetEvent = {
        id: Math.random().toString(),
        player: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        amount: BigInt(Math.floor(Math.random() * 500 + 10)) * BigInt("1000000000000000000"),
        odds: Math.floor(Math.random() * 90 + 5),
        won: Math.random() > 0.5,
        payout: BigInt(0),
        timestamp: Date.now(),
      };
      if (newBet.won) {
        newBet.payout = (newBet.amount * BigInt(100)) / BigInt(newBet.odds);
      }
      setBets((prev) => [newBet, ...prev.slice(0, 9)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden bg-background/50 border-y border-primary/20 py-3">
      <div className="flex gap-4 animate-slide-left">
        {[...bets, ...bets].map((bet, i) => (
          <BetCard key={`${bet.id}-${i}`} bet={bet} />
        ))}
      </div>
    </div>
  );
}
