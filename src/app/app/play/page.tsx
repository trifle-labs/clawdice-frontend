"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { formatEther, parseEther, decodeEventLog } from "viem";
import { Dice5, Volume2, VolumeX, Info, Clock, Zap } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { CONTRACTS, CLAWDICE_ABI, ERC20_ABI } from "@/lib/contracts";
import clsx from "clsx";

type BetState = "idle" | "approving" | "placing" | "waiting" | "claiming" | "won" | "lost";

export default function PlayPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("");
  const [odds, setOdds] = useState(50);
  const [betState, setBetState] = useState<BetState>("idle");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: bigint } | null>(null);
  const [currentBetId, setCurrentBetId] = useState<bigint | null>(null);
  const [useETH, setUseETH] = useState(false);

  // Read user token balance
  const { data: userTokenBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.baseSepolia.clawToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.baseSepolia.clawToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.baseSepolia.clawdice] : undefined,
  });

  // Read max bet for current odds
  const { data: maxBet } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdice,
    abi: CLAWDICE_ABI,
    functionName: "getMaxBet",
    args: [BigInt(odds) * BigInt(10 ** 16)],
  });

  // Write functions
  const { writeContract, data: txHash, isPending, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // Calculate payout
  const multiplier = 100 / odds;
  const potentialPayout = amount ? parseFloat(amount) * multiplier : 0;

  // Parse bet ID from BetPlaced event
  const parseBetId = useCallback((receipt: { logs: readonly { topics: readonly string[]; data: string }[] }) => {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: CLAWDICE_ABI,
          data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        if (decoded.eventName === "BetPlaced") {
          return (decoded.args as { betId: bigint }).betId;
        }
      } catch {
        // Not our event, continue
      }
    }
    return null;
  }, []);

  // Parse result from BetResolved event
  const parseResult = useCallback((receipt: { logs: readonly { topics: readonly string[]; data: string }[] }) => {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: CLAWDICE_ABI,
          data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        if (decoded.eventName === "BetResolved") {
          const args = decoded.args as { betId: bigint; won: boolean; payout: bigint };
          return { won: args.won, payout: args.payout };
        }
      } catch {
        // Not our event, continue
      }
    }
    return null;
  }, []);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && receipt) {
      if (betState === "approving") {
        refetchAllowance();
        setBetState("idle");
        resetWrite();
      } else if (betState === "placing") {
        const betId = parseBetId(receipt);
        if (betId) {
          setCurrentBetId(betId);
          setBetState("waiting");
          setIsRolling(true);
        }
      } else if (betState === "claiming") {
        const result = parseResult(receipt);
        if (result) {
          setLastResult(result);
          setBetState(result.won ? "won" : "lost");
          setIsRolling(false);
          refetchBalance();
        }
      }
    }
  }, [isSuccess, receipt, betState, parseBetId, parseResult, refetchAllowance, refetchBalance, resetWrite]);

  // Wait for next block then claim
  useEffect(() => {
    if (betState === "waiting" && currentBetId && publicClient) {
      const waitAndClaim = async () => {
        // Wait a bit for next block
        await new Promise((resolve) => setTimeout(resolve, 3000));

        setBetState("claiming");
        resetWrite();

        writeContract({
          address: CONTRACTS.baseSepolia.clawdice,
          abi: CLAWDICE_ABI,
          functionName: "claim",
          args: [currentBetId],
        });
      };

      waitAndClaim();
    }
  }, [betState, currentBetId, publicClient, writeContract, resetWrite]);

  const needsApproval = useCallback(() => {
    if (useETH) return false;
    if (!amount || !allowance) return true;
    try {
      return parseEther(amount) > allowance;
    } catch {
      return true;
    }
  }, [amount, allowance, useETH]);

  const handleApprove = async () => {
    if (!address || !amount) return;
    setBetState("approving");

    writeContract({
      address: CONTRACTS.baseSepolia.clawToken,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.baseSepolia.clawdice, parseEther(amount)],
    });
  };

  const handlePlaceBet = async () => {
    if (!address || !amount) return;

    setBetState("placing");

    if (useETH) {
      // Place bet with ETH (atomic swap)
      writeContract({
        address: CONTRACTS.baseSepolia.clawdice,
        abi: CLAWDICE_ABI,
        functionName: "placeBetWithETH",
        args: [BigInt(odds) * BigInt(10 ** 16), BigInt(0)], // 0 minTokensOut for simplicity
        value: parseEther(amount),
      });
    } else {
      // Place bet with CLAW
      writeContract({
        address: CONTRACTS.baseSepolia.clawdice,
        abi: CLAWDICE_ABI,
        functionName: "placeBet",
        args: [parseEther(amount), BigInt(odds) * BigInt(10 ** 16)],
      });
    }
  };

  const handleReset = () => {
    setBetState("idle");
    setLastResult(null);
    setCurrentBetId(null);
    resetWrite();
  };

  const handleMax = () => {
    if (userTokenBalance && maxBet) {
      const maxAllowed = userTokenBalance < maxBet ? userTokenBalance : maxBet;
      setAmount(formatEther(maxAllowed));
    }
  };

  return (
    <div className="min-h-screen bg-kawaii py-8 pt-20">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-display text-foreground">Play</h1>
            <p className="text-foreground/60 text-sm">Roll the dice, test your luck</p>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 glass rounded-lg hover:bg-white/80 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-foreground/70" />
            ) : (
              <VolumeX className="w-5 h-5 text-foreground/40" />
            )}
          </button>
        </div>

        {/* Main Game Card */}
        <div className="card-kawaii p-6">
          {/* Dice Display */}
          <div className="flex justify-center mb-6">
            <div
              className={clsx(
                "w-28 h-28 md:w-36 md:h-36 rounded-2xl flex items-center justify-center transition-all",
                betState === "won" && "bg-mint/30",
                betState === "lost" && "bg-claw/20",
                betState === "idle" && "bg-primary/10",
                (betState === "waiting" || betState === "claiming") && "bg-accent/20"
              )}
            >
              <Dice5
                className={clsx(
                  "w-16 h-16 md:w-20 md:h-20 transition-colors",
                  betState === "won" && "text-mint-dark",
                  betState === "lost" && "text-claw",
                  betState === "idle" && "text-primary",
                  isRolling && "animate-spin text-accent"
                )}
              />
            </div>
          </div>

          {/* Result Display */}
          {(betState === "won" || betState === "lost") && lastResult && (
            <div
              className={clsx(
                "text-center mb-6 p-4 rounded-xl",
                betState === "won" ? "bg-mint/20" : "bg-claw/10"
              )}
            >
              <p className={clsx("text-2xl font-bold", betState === "won" ? "text-mint-dark" : "text-claw")}>
                {betState === "won" ? "YOU WON! ✨" : "YOU LOST"}
              </p>
              {betState === "won" && lastResult.payout > 0n && (
                <p className="text-lg text-mint-dark mt-1">
                  +{Number(formatEther(lastResult.payout)).toLocaleString()} CLAW
                </p>
              )}
              <button
                onClick={handleReset}
                className="mt-3 px-5 py-2 btn-kawaii text-sm"
              >
                Play Again
              </button>
            </div>
          )}

          {/* Status Messages */}
          {betState === "approving" && (
            <div className="text-center mb-6 text-foreground/60">
              <Clock className="w-5 h-5 mx-auto mb-1 animate-spin" />
              <p className="text-sm">Approving tokens...</p>
            </div>
          )}
          {betState === "placing" && (
            <div className="text-center mb-6 text-foreground/60">
              <Clock className="w-5 h-5 mx-auto mb-1 animate-spin" />
              <p className="text-sm">Placing bet...</p>
            </div>
          )}
          {betState === "waiting" && (
            <div className="text-center mb-6 text-accent-dark">
              <Clock className="w-5 h-5 mx-auto mb-1 animate-spin" />
              <p className="text-sm">Waiting for next block...</p>
            </div>
          )}
          {betState === "claiming" && (
            <div className="text-center mb-6 text-primary-dark">
              <Dice5 className="w-5 h-5 mx-auto mb-1 animate-spin" />
              <p className="text-sm">Revealing result...</p>
            </div>
          )}

          {/* Bet Controls */}
          {!isConnected ? (
            <div className="text-center py-6">
              <p className="text-foreground/60 mb-3 text-sm">Connect wallet to play</p>
              <ConnectKitButton />
            </div>
          ) : betState === "idle" ? (
            <>
              {/* Payment Toggle */}
              <div className="flex justify-center mb-4">
                <div className="inline-flex glass rounded-full p-1 text-sm">
                  <button
                    onClick={() => setUseETH(false)}
                    className={clsx(
                      "px-4 py-1.5 rounded-full transition-all",
                      !useETH ? "bg-primary text-white" : "text-foreground/60"
                    )}
                  >
                    CLAW
                  </button>
                  <button
                    onClick={() => setUseETH(true)}
                    className={clsx(
                      "px-4 py-1.5 rounded-full transition-all flex items-center gap-1",
                      useETH ? "bg-accent text-white" : "text-foreground/60"
                    )}
                  >
                    <Zap className="w-3 h-3" />
                    ETH
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="text-xs text-foreground/60 mb-1 block">Bet Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-white/50 border border-primary/20 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:border-primary"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-foreground/50 text-sm">{useETH ? "ETH" : "CLAW"}</span>
                    {!useETH && (
                      <button
                        onClick={handleMax}
                        className="text-primary-dark hover:text-primary text-xs font-medium"
                      >
                        MAX
                      </button>
                    )}
                  </div>
                </div>
                {!useETH && (
                  <p className="text-xs text-foreground/50 mt-1">
                    Balance: {userTokenBalance ? Number(formatEther(userTokenBalance)).toLocaleString() : "0"} CLAW
                  </p>
                )}
              </div>

              {/* Odds Slider */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground/60">Win Chance</span>
                  <span className="text-primary-dark font-medium">{odds}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={odds}
                  onChange={(e) => setOdds(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/50 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Payout Preview */}
              <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-white/30 rounded-xl text-sm">
                <div>
                  <p className="text-foreground/60 text-xs">Multiplier</p>
                  <p className="font-bold text-primary-dark">{multiplier.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-foreground/60 text-xs">Win</p>
                  <p className="font-bold text-accent-dark">
                    {potentialPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })} {useETH ? "CLAW" : "CLAW"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {needsApproval() ? (
                <button
                  onClick={handleApprove}
                  disabled={!amount || isPending || isConfirming}
                  className="w-full btn-kawaii disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending || isConfirming ? "Approving..." : "Approve CLAW"}
                </button>
              ) : (
                <button
                  onClick={handlePlaceBet}
                  disabled={!amount || isPending || isConfirming}
                  className="w-full btn-accent rounded-full py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Dice5 className="w-5 h-5" />
                  {isPending || isConfirming ? "Processing..." : "Roll the Dice"}
                </button>
              )}
            </>
          ) : null}
        </div>

        {/* Info Box */}
        <div className="card-kawaii p-4 mt-4 flex gap-3">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/60">
            Result determined by next block&apos;s hash. 1% house edge. Claim within 255 blocks (~8.5 min).
            {useETH && " ETH is swapped to CLAW atomically via Uniswap V4."}
          </p>
        </div>
      </div>
    </div>
  );
}
