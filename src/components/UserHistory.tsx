"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { X, History, Check, AlertCircle, Clock, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { getBetsByPlayer, subscribeToBets, BetEvent } from "@/lib/indexer";

interface UserHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserHistory({ isOpen, onClose }: UserHistoryProps) {
  const { address } = useAccount();
  const [bets, setBets] = useState<BetEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user's bet history
  useEffect(() => {
    if (!address || !isOpen) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const history = await getBetsByPlayer(address, 50);
        setBets(history);
      } catch (err) {
        console.error("Failed to fetch bet history:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [address, isOpen]);

  // Subscribe to new bets for this user
  useEffect(() => {
    if (!address || !isOpen) return;

    const unsubscribe = subscribeToBets((bet) => {
      if (bet.player.toLowerCase() === address.toLowerCase()) {
        setBets((prev) => [bet, ...prev.slice(0, 49)]);
      }
    });

    return unsubscribe;
  }, [address, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150]"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-cream shadow-2xl z-[151] animate-slide-in-right overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary/20">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-display text-foreground">Your Bets</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!address ? (
            <div className="text-center py-8 text-foreground/60">
              Connect wallet to see your history
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-foreground/60">
              Loading...
            </div>
          ) : bets.length === 0 ? (
            <div className="text-center py-8 text-foreground/60">
              No bets yet. Place your first bet!
            </div>
          ) : (
            <div className="space-y-3">
              {bets.map((bet) => (
                <BetCard key={bet.betId} bet={bet} />
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {address && bets.length > 0 && (
          <div className="p-4 border-t border-primary/20 bg-white/30">
            <UserStats bets={bets} />
          </div>
        )}
      </div>
    </>
  );
}

function BetCard({ bet }: { bet: BetEvent }) {
  const status = bet.won !== undefined ? (bet.won ? "won" : "lost") : (bet.expired ? "expired" : "pending");
  
  const statusConfig = {
    won: { icon: <Check className="w-4 h-4" />, color: "text-mint-dark", bg: "bg-mint/20" },
    lost: { icon: <AlertCircle className="w-4 h-4" />, color: "text-claw", bg: "bg-claw/10" },
    expired: { icon: <Clock className="w-4 h-4" />, color: "text-foreground/50", bg: "bg-foreground/10" },
    pending: { icon: <Clock className="w-4 h-4 animate-pulse" />, color: "text-primary", bg: "bg-primary/10" },
  };

  const config = statusConfig[status];
  const amountNum = Number(formatEther(bet.amount));
  const payoutNum = bet.payout ? Number(formatEther(bet.payout)) : 0;
  const netResult = status === "won" ? payoutNum - amountNum : -amountNum;

  return (
    <div className={clsx("rounded-xl p-3 border", config.bg, "border-foreground/10")}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className="text-sm font-medium text-foreground">
            Bet #{bet.betId}
          </span>
        </div>
        <a
          href={`https://sepolia.basescan.org/tx/${bet.betId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/40 hover:text-foreground/60"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-foreground/50">Amount</p>
          <p className="font-medium">{amountNum.toFixed(2)} CLAW</p>
        </div>
        <div>
          <p className="text-foreground/50">Odds</p>
          <p className="font-medium">{bet.odds}%</p>
        </div>
        <div>
          <p className="text-foreground/50">Result</p>
          <p className={clsx("font-medium", netResult >= 0 ? "text-mint-dark" : "text-claw")}>
            {status === "pending" ? "..." : `${netResult >= 0 ? "+" : ""}${netResult.toFixed(2)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function UserStats({ bets }: { bets: BetEvent[] }) {
  const completedBets = bets.filter((b) => b.won !== undefined);
  const wins = completedBets.filter((b) => b.won).length;
  const losses = completedBets.filter((b) => !b.won).length;
  const winRate = completedBets.length > 0 ? (wins / completedBets.length) * 100 : 0;
  
  const totalWagered = bets.reduce((sum, b) => sum + Number(formatEther(b.amount)), 0);
  const totalPayout = bets.reduce((sum, b) => sum + (b.payout ? Number(formatEther(b.payout)) : 0), 0);
  const netProfit = totalPayout - totalWagered;

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <p className="text-xs text-foreground/50">Win Rate</p>
        <p className="text-lg font-bold text-foreground">{winRate.toFixed(0)}%</p>
        <p className="text-xs text-foreground/50">{wins}W / {losses}L</p>
      </div>
      <div>
        <p className="text-xs text-foreground/50">Wagered</p>
        <p className="text-lg font-bold text-foreground">{totalWagered.toFixed(0)}</p>
        <p className="text-xs text-foreground/50">CLAW</p>
      </div>
      <div>
        <p className="text-xs text-foreground/50">Net P/L</p>
        <p className={clsx("text-lg font-bold", netProfit >= 0 ? "text-mint-dark" : "text-claw")}>
          {netProfit >= 0 ? "+" : ""}{netProfit.toFixed(0)}
        </p>
        <p className="text-xs text-foreground/50">CLAW</p>
      </div>
    </div>
  );
}
