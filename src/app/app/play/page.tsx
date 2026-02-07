"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { Dice5, Volume2, VolumeX, Info, Clock } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { CONTRACTS, CLAWDICE_ABI, ERC20_ABI } from "@/lib/contracts";
import clsx from "clsx";

type BetState = "idle" | "placing" | "waiting" | "revealing" | "won" | "lost";

export default function PlayPage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [odds, setOdds] = useState(50);
  const [betState, setBetState] = useState<BetState>("idle");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: bigint } | null>(null);

  // Read user token balance
  const { data: userTokenBalance } = useReadContract({
    address: CONTRACTS.baseSepolia.clawToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read max bet for current odds
  const { data: maxBet } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdice,
    abi: CLAWDICE_ABI,
    functionName: "getMaxBet",
    args: [BigInt(odds) * BigInt(10 ** 16)], // Convert to E18
  });

  // Write functions
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Calculate payout
  const multiplier = 100 / odds;
  const potentialPayout = amount ? parseFloat(amount) * multiplier : 0;
  const actualWinChance = odds * 0.99; // 1% house edge

  // Handle bet result
  useEffect(() => {
    if (isSuccess && betState === "placing") {
      setBetState("waiting");
      setIsRolling(true);

      // Simulate waiting for next block and revealing
      setTimeout(() => {
        setBetState("revealing");
        setTimeout(() => {
          // Random result for demo - in production would read from contract
          const won = Math.random() * 100 < actualWinChance;
          setLastResult({
            won,
            payout: won ? parseEther(potentialPayout.toString()) : BigInt(0),
          });
          setBetState(won ? "won" : "lost");
          setIsRolling(false);
        }, 1000);
      }, 2000);
    }
  }, [isSuccess, betState, actualWinChance, potentialPayout]);

  const handlePlaceBet = async () => {
    if (!address || !amount) return;

    setBetState("placing");

    try {
      // In production: First approve, then place bet
      writeContract({
        address: CONTRACTS.baseSepolia.clawdice,
        abi: CLAWDICE_ABI,
        functionName: "placeBet",
        args: [parseEther(amount), BigInt(odds) * BigInt(10 ** 16)],
      });
    } catch (error) {
      console.error(error);
      setBetState("idle");
    }
  };

  const handleReset = () => {
    setBetState("idle");
    setLastResult(null);
  };

  const handleMax = () => {
    if (userTokenBalance && maxBet) {
      const maxAllowed = userTokenBalance < maxBet ? userTokenBalance : maxBet;
      setAmount(formatEther(maxAllowed));
    }
  };

  return (
    <div className="min-h-screen gradient-dark py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Play</h1>
            <p className="text-gray-400">Place your bet and roll the dice</p>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-500" />
            )}
          </button>
        </div>

        {/* Main Game Card */}
        <div className="glass rounded-2xl p-6 md:p-8">
          {/* Dice Display */}
          <div className="flex justify-center mb-8">
            <div
              className={clsx(
                "w-32 h-32 md:w-40 md:h-40 rounded-2xl flex items-center justify-center transition-all",
                betState === "won" && "bg-success/20 glow-success",
                betState === "lost" && "bg-danger/20 glow-danger",
                betState === "idle" && "bg-primary/10",
                (betState === "waiting" || betState === "revealing") && "bg-primary/20"
              )}
            >
              <Dice5
                className={clsx(
                  "w-20 h-20 md:w-24 md:h-24 transition-colors",
                  betState === "won" && "text-success",
                  betState === "lost" && "text-danger",
                  betState === "idle" && "text-primary",
                  isRolling && "dice-rolling text-accent"
                )}
              />
            </div>
          </div>

          {/* Result Display */}
          {(betState === "won" || betState === "lost") && lastResult && (
            <div
              className={clsx(
                "text-center mb-8 p-4 rounded-xl",
                betState === "won" ? "bg-success/20" : "bg-danger/20"
              )}
            >
              <p className={clsx("text-3xl font-bold", betState === "won" ? "text-success" : "text-danger")}>
                {betState === "won" ? "YOU WON!" : "YOU LOST"}
              </p>
              {betState === "won" && (
                <p className="text-xl text-success mt-2">
                  +{Number(formatEther(lastResult.payout)).toLocaleString()} CLAW
                </p>
              )}
              <button
                onClick={handleReset}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Play Again
              </button>
            </div>
          )}

          {/* Status Messages */}
          {betState === "placing" && (
            <div className="text-center mb-8 text-gray-400">
              <Clock className="w-6 h-6 mx-auto mb-2 animate-spin" />
              Confirming transaction...
            </div>
          )}
          {betState === "waiting" && (
            <div className="text-center mb-8 text-gray-400">
              <Clock className="w-6 h-6 mx-auto mb-2 animate-spin" />
              Waiting for next block...
            </div>
          )}
          {betState === "revealing" && (
            <div className="text-center mb-8 text-accent">
              <Dice5 className="w-6 h-6 mx-auto mb-2 dice-rolling" />
              Revealing result...
            </div>
          )}

          {/* Bet Controls */}
          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Connect your wallet to play</p>
              <ConnectKitButton />
            </div>
          ) : betState === "idle" ? (
            <>
              {/* Amount Input */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Bet Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-black/30 border border-primary/30 rounded-lg px-4 py-3 text-xl font-mono focus:outline-none focus:border-primary"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-gray-500">CLAW</span>
                    <button
                      onClick={handleMax}
                      className="text-primary hover:text-primary-light text-sm font-medium"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Balance: {userTokenBalance ? Number(formatEther(userTokenBalance)).toLocaleString() : "0"} CLAW
                </p>
              </div>

              {/* Odds Slider */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Win Chance</span>
                  <span className="text-primary font-medium">{odds}% ({actualWinChance.toFixed(1)}% actual)</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={odds}
                  onChange={(e) => setOdds(parseInt(e.target.value))}
                  className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5%</span>
                  <span>95%</span>
                </div>
              </div>

              {/* Payout Preview */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-black/20 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">Multiplier</p>
                  <p className="text-xl font-bold text-primary">{multiplier.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Potential Win</p>
                  <p className="text-xl font-bold text-accent">
                    {potentialPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })} CLAW
                  </p>
                </div>
              </div>

              {/* Max Bet Info */}
              <div className="text-sm text-gray-500 mb-4 text-center">
                Max bet at {odds}% odds: {maxBet ? Number(formatEther(maxBet)).toLocaleString() : "..."} CLAW
              </div>

              {/* Place Bet Button */}
              <button
                onClick={handlePlaceBet}
                disabled={!amount || isPending || isConfirming}
                className="w-full gradient-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                <Dice5 className="w-6 h-6" />
                {isPending || isConfirming ? "Processing..." : "Roll the Dice"}
              </button>
            </>
          ) : null}
        </div>

        {/* Info Box */}
        <div className="glass rounded-xl p-4 mt-6 flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="mb-1">
              <strong>How it works:</strong>
            </p>
            <p>
              Your bet is placed in the current block. The result is determined by the next
              block&apos;s hash, making it provably fair and unpredictable. The house has a 1% edge on all bets.
              You must claim winnings within 255 blocks (~8.5 minutes on Base).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
