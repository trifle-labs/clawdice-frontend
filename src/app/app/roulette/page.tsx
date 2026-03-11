"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useBalance,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther, parseEther, decodeEventLog } from "viem";
import { Info, Zap, Coins, History, ToggleLeft, ToggleRight, X, Check, AlertCircle } from "lucide-react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { CONTRACTS, CLAWDICE_ABI, ERC20_ABI } from "@/lib/contracts";
import { SwapModal } from "@/components/SwapModal";
import { RouletteWheel, BetColor } from "@/components/RouletteWheel";
import { UserHistory } from "@/components/UserHistory";
import { useNotifications } from "@/components/Notifications";
import { useSponsoredClaim } from "@/hooks/useSponsoredClaim";
import { useAutoReveal } from "@/hooks/useAutoReveal";
import { useSessionKey } from "@/hooks/useSessionKey";
import clsx from "clsx";

type BetState = "idle" | "placing" | "waiting" | "claiming" | "won" | "lost";

// European roulette: 18/37 odds in E18 format (exact integer arithmetic)
const ROULETTE_ODDS_E18 = (18n * 10n ** 18n) / 37n; // ≈ 486486486486486486
const ROULETTE_WIN_CHANCE = (18 / 37) * 100; // ≈ 48.648%
const ROULETTE_MULTIPLIER = 37 / 18; // ≈ 2.056x (before house edge)

export default function RoulettePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { sponsoredClaim } = useSponsoredClaim();
  const { revealedBets, revealingBets, clearRevealed } = useAutoReveal();
  const {
    isActive: hasSession,
    isCreating: isCreatingSession,
    createSession,
    placeBetWithSession,
    timeRemaining: sessionTimeRemaining,
    error: sessionError,
  } = useSessionKey();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { open: openWalletModal } = useWeb3Modal();
  const isWrongNetwork = isConnected && chainId !== 84532;
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [betColor, setBetColor] = useState<BetColor>("red");
  const currentBetColorRef = useRef<BetColor>("red");
  const [betState, setBetState] = useState<BetState>("idle");
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{
    won: boolean;
    payout: bigint;
    resultPosition?: number;
    landedColor?: string;
    landedNumber?: number;
  } | null>(null);
  const [currentBetId, setCurrentBetId] = useState<bigint | null>(null);
  const [resultPosition, setResultPosition] = useState<number | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [useETH, setUseETH] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const { addNotification } = useNotifications();
  const [pendingNotification, setPendingNotification] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [skipWalletPopup, setSkipWalletPopup] = useState(false);
  const [didMount, setDidMount] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("clawdice_skip_wallet_popup");
    if (stored === "true" && hasSession) {
      setSkipWalletPopup(true);
    } else if (hasSession && stored !== "false") {
      setSkipWalletPopup(true);
      localStorage.setItem("clawdice_skip_wallet_popup", "true");
    }
  }, [hasSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!didMount) { setDidMount(true); return; }
    localStorage.setItem("clawdice_skip_wallet_popup", skipWalletPopup ? "true" : "false");
  }, [skipWalletPopup, didMount]);

  // Show notification after spin completes
  useEffect(() => {
    if (!isRolling && pendingNotification) {
      addNotification(pendingNotification);
      setPendingNotification(null);
    }
  }, [isRolling, pendingNotification, addNotification]);

  const { data: userTokenBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.baseSepolia.clawToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: ethBalance } = useBalance({ address });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.baseSepolia.clawToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.baseSepolia.clawdice] : undefined,
  });

  const { data: maxBet } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdice,
    abi: CLAWDICE_ABI,
    functionName: "getMaxBet",
    args: [ROULETTE_ODDS_E18 as unknown as bigint],
  });

  useEffect(() => {
    if (revealedBets.length > 0) {
      refetchBalance();
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    }
  }, [revealedBets.length, refetchBalance, queryClient]);

  const {
    writeContract,
    writeContractAsync,
    data: txHash,
    isPending,
    reset: resetWrite,
    error: writeError,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
    error: txError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const potentialPayout = amount ? parseFloat(amount) * ROULETTE_MULTIPLIER : 0;

  const scrollToSpinner = useCallback(() => {
    setTimeout(() => {
      spinnerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const parseBetId = useCallback(
    (receipt: { logs: readonly { topics: readonly string[]; data: string }[] }) => {
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
        } catch { /* not our event */ }
      }
      return null;
    },
    []
  );

  const parseResult = useCallback(
    (receipt: { logs: readonly { topics: readonly string[]; data: string }[] }) => {
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
        } catch { /* not our event */ }
      }
      return null;
    },
    []
  );

  const parseErrorMessage = (err: Error | null): { msg: string; details: string } => {
    if (!err) return { msg: "Unknown error", details: "" };
    const fullMessage = err.message || String(err);
    if (fullMessage.includes("user rejected") || fullMessage.includes("User denied")) {
      return { msg: "Transaction cancelled", details: "" };
    }
    if (fullMessage.includes("insufficient") || fullMessage.includes("exceeds balance")) {
      return { msg: "Insufficient balance", details: fullMessage };
    }
    const revertMatch = fullMessage.match(/reverted with reason string '([^']+)'/);
    if (revertMatch) return { msg: revertMatch[1], details: fullMessage };
    const customErrorMatch = fullMessage.match(/reverted with custom error '([^']+)'/);
    if (customErrorMatch) return { msg: `Contract error: ${customErrorMatch[1]}`, details: fullMessage };
    const shortMsgMatch = fullMessage.match(/^([^.!?\n]{1,100}[.!?]?)/);
    return { msg: shortMsgMatch ? shortMsgMatch[1] : "Transaction failed", details: fullMessage };
  };

  const computeResultPosition = useCallback(
    async (betId: bigint, betBlockNumber: bigint): Promise<number> => {
      if (!publicClient) return 50;
      try {
        const resultBlock = betBlockNumber + BigInt(1);
        const block = await publicClient.getBlock({ blockNumber: resultBlock });
        if (!block?.hash) return 50;
        const { keccak256, encodePacked } = await import("viem");
        const randomResult = BigInt(
          keccak256(encodePacked(["uint256", "bytes32"], [betId, block.hash]))
        );
        const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const E18 = BigInt("1000000000000000000");
        const scaleFactor = MAX_UINT256 / E18;
        const scaledResult = randomResult / scaleFactor;
        return Number((scaledResult * BigInt(10000)) / E18) / 100;
      } catch (err) {
        console.error("Failed to compute result position:", err);
        return 50;
      }
    },
    [publicClient]
  );

  // Handle transaction errors
  useEffect(() => {
    if (writeError || txError) {
      const err = writeError || txError;
      const { msg, details } = parseErrorMessage(err);
      setErrorMsg(msg);
      setErrorDetails(details);
      setShowErrorDetails(false);
      setBetState("idle");
      setIsRolling(false);
      resetWrite();
    }
  }, [writeError, txError, resetWrite]);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && receipt) {
      if (betState === "placing") {
        const betId = parseBetId(receipt);
        if (betId) {
          setCurrentBetId(betId);
          setBetState("waiting");
          refetchBalance();
        }
      } else if (betState === "claiming") {
        let isOurBet = true;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: CLAWDICE_ABI,
              data: log.data as `0x${string}`,
              topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
            });
            if (decoded.eventName === "BetClaimed") {
              const { player } = decoded.args as { player: `0x${string}` };
              isOurBet = player.toLowerCase() === address?.toLowerCase();
              break;
            }
          } catch { /* ignore */ }
        }

        if (isOurBet) {
          const result = parseResult(receipt);
          if (result && currentBetId && publicClient) {
            (async () => {
              try {
                const betInfo = await publicClient.readContract({
                  address: CONTRACTS.baseSepolia.clawdice,
                  abi: CLAWDICE_ABI,
                  functionName: "getBet",
                  args: [currentBetId],
                }) as { blockNumber: bigint };
                const position = await computeResultPosition(currentBetId, betInfo.blockNumber);
                setResultPosition(position);
                setWon(result.won);
                // Determine what the wheel will land on (for result display)
                const landedColor = result.won
                  ? currentBetColorRef.current
                  : currentBetColorRef.current === "red" ? "black" : "red";
                setLastResult({ ...result, resultPosition: position, landedColor });
              } catch (err) {
                console.error("Failed to compute result position:", err);
                setLastResult(result);
                setIsRolling(false);
              }
              setBetState(result.won ? "won" : "lost");
              refetchBalance();
            })();
          }
        } else {
          setBetState("idle");
          setIsRolling(false);
        }
      }
    }
  }, [isSuccess, receipt, betState, parseBetId, parseResult, queryClient, refetchBalance, refetchAllowance, resetWrite, address, currentBetId, publicClient, computeResultPosition]);

  // Wait for next block then claim
  useEffect(() => {
    if (betState === "waiting" && currentBetId && publicClient) {
      const waitAndClaim = async () => {
        let betBlockNumber: bigint | null = null;

        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const betData = await publicClient.readContract({
              address: CONTRACTS.baseSepolia.clawdice,
              abi: CLAWDICE_ABI,
              functionName: "getBet",
              args: [currentBetId],
            });
            const bet = betData as { player: `0x${string}`; amount: bigint; targetOddsE18: bigint; blockNumber: bigint; status: number };
            if (bet.blockNumber && bet.blockNumber > BigInt(0)) {
              betBlockNumber = bet.blockNumber;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Error fetching bet (attempt ${attempt + 1}):`, err);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        try {
          if (betBlockNumber) {
            const targetBlock = betBlockNumber + BigInt(1);
            let currentBlock = await publicClient.getBlockNumber();
            while (currentBlock <= targetBlock) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              currentBlock = await publicClient.getBlockNumber();
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (err) {
          console.error("Error waiting for block:", err);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        setBetState("claiming");

        const sponsoredTxHash = await sponsoredClaim(currentBetId);

        if (sponsoredTxHash) {
          try {
            const sponsoredReceipt = await publicClient.waitForTransactionReceipt({
              hash: sponsoredTxHash,
              timeout: 60000,
            });

            for (const log of sponsoredReceipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: CLAWDICE_ABI,
                  data: log.data,
                  topics: log.topics,
                });
                if (decoded.eventName === "BetClaimed") {
                  const { player, payout } = decoded.args as { betId: bigint; player: `0x${string}`; payout: bigint };
                  if (player.toLowerCase() === address?.toLowerCase()) {
                    const betInfo = await publicClient.readContract({
                      address: CONTRACTS.baseSepolia.clawdice,
                      abi: CLAWDICE_ABI,
                      functionName: "getBet",
                      args: [currentBetId],
                    }) as { blockNumber: bigint };
                    const position = await computeResultPosition(currentBetId, betInfo.blockNumber);
                    setResultPosition(position);
                    setWon(true);
                    setLastResult({ won: true, payout, resultPosition: position, landedColor: currentBetColorRef.current });
                    setBetState("won");
                    refetchBalance();
                    setPendingNotification({
                      type: "success",
                      title: "You Won! 🎉",
                      message: `+${Number(formatEther(payout)).toFixed(2)} CLAW`,
                    });
                    return;
                  } else {
                    setBetState("idle");
                    setIsRolling(false);
                    setResultPosition(null);
                    setWon(null);
                    return;
                  }
                }
                if (decoded.eventName === "BetResolved") {
                  const { won: resolvedWon } = decoded.args as { won: boolean; payout: bigint };
                  if (!resolvedWon) {
                    const betData = await publicClient.readContract({
                      address: CONTRACTS.baseSepolia.clawdice,
                      abi: CLAWDICE_ABI,
                      functionName: "getBet",
                      args: [currentBetId],
                    }) as { player: `0x${string}`; blockNumber: bigint };
                    if (betData.player.toLowerCase() === address?.toLowerCase()) {
                      const position = await computeResultPosition(currentBetId, betData.blockNumber);
                      const loseColor = currentBetColorRef.current === "red" ? "black" : "red";
                      setResultPosition(position);
                      setWon(false);
                      setLastResult({ won: false, payout: BigInt(0), resultPosition: position, landedColor: loseColor });
                      setBetState("lost");
                      refetchBalance();
                      setPendingNotification({
                        type: "error",
                        title: "You Lost",
                        message: "Better luck next time!",
                      });
                    } else {
                      setBetState("idle");
                      setIsRolling(false);
                      setResultPosition(null);
                      setWon(null);
                    }
                    return;
                  }
                }
              } catch { /* ignore */ }
            }
          } catch (err) {
            console.error("Sponsored claim tx failed:", err);
          }
        }

        // Fallback to regular claim
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
  }, [betState, currentBetId, publicClient, sponsoredClaim, writeContract, resetWrite, refetchBalance, address, computeResultPosition, addNotification]);

  const needsApproval = useCallback(() => {
    if (useETH) return false;
    if (!amount || parseFloat(amount) === 0) return false;
    if (!allowance) return true;
    try {
      return parseEther(amount) > allowance;
    } catch {
      return false;
    }
  }, [amount, allowance, useETH]);

  const handleApprove = async () => {
    if (!address || !publicClient) return;
    setIsApproving(true);
    setErrorMsg(null);
    try {
      const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      const hash = await writeContractAsync({
        address: CONTRACTS.baseSepolia.clawToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.baseSepolia.clawdice, MAX_UINT256],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        let attempts = 0;
        while (attempts < 10) {
          await new Promise((r) => setTimeout(r, 1000));
          const { data: newAllowance } = await refetchAllowance();
          if (newAllowance && newAllowance > BigInt(0)) break;
          attempts++;
        }
        queryClient.invalidateQueries({ queryKey: ["readContract"] });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      if (!msg.includes("rejected")) setErrorMsg(msg);
    } finally {
      setIsApproving(false);
      resetWrite();
    }
  };

  const handlePlaceBet = async () => {
    if (!address || !amount) return;
    currentBetColorRef.current = betColor;
    setBetState("placing");
    setIsRolling(true);
    setWon(null);
    setResultPosition(null);
    setErrorMsg(null);
    scrollToSpinner();

    if (skipWalletPopup && hasSession && !useETH) {
      try {
        const txHash = await placeBetWithSession(
          parseEther(amount),
          ROULETTE_ODDS_E18 as unknown as bigint
        );
        if (txHash && publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          if (receipt.status === "success") {
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({ abi: CLAWDICE_ABI, data: log.data, topics: log.topics });
                if (decoded.eventName === "BetPlaced" || decoded.eventName === "BetPlacedViaSession") {
                  const betId = (decoded.args as { betId: bigint }).betId;
                  setCurrentBetId(betId);
                  setBetState("waiting");
                  refetchBalance();
                  addNotification({ type: "info", title: "Bet Placed", message: `Roulette bet placed - waiting for spin...`, txHash });
                  return;
                }
              } catch { /* ignore */ }
            }
          }
          throw new Error("Could not find bet ID in transaction");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Session bet failed";
        setErrorMsg(errorMessage);
        setBetState("idle");
        setIsRolling(false);
        return;
      }
    }

    if (useETH) {
      writeContract({
        address: CONTRACTS.baseSepolia.clawdice,
        abi: CLAWDICE_ABI,
        functionName: "placeBetWithETH",
        args: [ROULETTE_ODDS_E18 as unknown as bigint, BigInt(0)],
        value: parseEther(amount),
        gas: BigInt(500_000),
      });
    } else {
      writeContract({
        address: CONTRACTS.baseSepolia.clawdice,
        abi: CLAWDICE_ABI,
        functionName: "placeBet",
        args: [parseEther(amount), ROULETTE_ODDS_E18 as unknown as bigint],
      });
    }
  };

  const handleReset = () => {
    setBetState("idle");
    setLastResult(null);
    setResultPosition(null);
    setWon(null);
    setCurrentBetId(null);
    setSelectedPreset(null);
    resetWrite();
  };

  const handleMax = () => {
    setSelectedPreset(null);
    if (useETH) {
      if (ethBalance) {
        const max = Math.max(0, Number(ethBalance.formatted) - 0.001);
        setAmount(max.toFixed(6));
      }
    } else {
      if (userTokenBalance && maxBet) {
        const maxAllowed = userTokenBalance < maxBet ? userTokenBalance : maxBet;
        setAmount(formatEther(maxAllowed));
      }
    }
  };

  // Color button style helper
  const colorButtonClass = (color: BetColor) => {
    const isSelected = betColor === color;
    if (color === "red") {
      return clsx(
        "flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
        isSelected
          ? "bg-red-600 text-white shadow-lg scale-105"
          : "bg-red-100 text-red-700 hover:bg-red-200 border-2 border-red-200"
      );
    }
    return clsx(
      "flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
      isSelected
        ? "bg-gray-900 text-white shadow-lg scale-105"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-200"
    );
  };

  // Determine landed color/number from lastResult
  const landedColor = lastResult?.landedColor;
  const colorDisplay = landedColor
    ? landedColor === "red"
      ? "🔴 Red"
      : landedColor === "black"
      ? "⚫ Black"
      : "🟢 Green"
    : null;

  return (
    <div className="min-h-screen bg-kawaii py-8 pt-20">
      {/* Auto-reveal Toasts */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {revealingBets.size > 0 && (
          <div className="glass rounded-xl p-3 flex items-center gap-3 shadow-lg animate-pulse">
            <Zap className="w-5 h-5 text-accent animate-pulse" />
            <span className="text-sm text-foreground">
              Revealing {revealingBets.size} pending bet{revealingBets.size > 1 ? "s" : ""}...
            </span>
          </div>
        )}
        {revealedBets.map((result) => (
          <div
            key={result.betId}
            className={clsx(
              "rounded-xl p-3 flex items-center gap-3 shadow-lg",
              result.won ? "bg-mint/90" : "bg-white/90"
            )}
          >
            {result.won ? (
              <Check className="w-5 h-5 text-mint-dark" />
            ) : (
              <AlertCircle className="w-5 h-5 text-foreground/50" />
            )}
            <div className="flex-1">
              <p className={clsx("text-sm font-medium", result.won ? "text-mint-dark" : "text-foreground/70")}>
                {result.won ? "You won!" : "Better luck next time"}
              </p>
              {result.won && result.payout > 0n && (
                <p className="text-xs text-mint-dark">
                  +{Number(formatEther(result.payout)).toLocaleString()} CLAW
                </p>
              )}
            </div>
            <button onClick={() => clearRevealed(result.betId)} className="p-1 hover:bg-white/50 rounded">
              <X className="w-4 h-4 text-foreground/50" />
            </button>
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-display text-foreground">ClawRoulette</h1>
            <p className="text-foreground/60 text-sm">Bet red or black, spin the wheel</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen(true)}
              className="p-2 glass rounded-lg hover:bg-white/80 transition-colors"
              title="Bet History"
            >
              <History className="w-5 h-5 text-foreground/70" />
            </button>
          </div>
        </div>

        {/* Main Game Card */}
        <div className="card-kawaii p-6">
          {/* Roulette Wheel */}
          <div ref={spinnerRef} className="flex justify-center mb-6">
            <RouletteWheel
              isSpinning={isRolling}
              resultPosition={resultPosition}
              won={won}
              betColor={currentBetColorRef.current}
              size={220}
              onSpinComplete={() => setIsRolling(false)}
            />
          </div>

          {/* Result Display */}
          {(betState === "won" || betState === "lost") && lastResult && !isRolling && (
            <div
              className={clsx(
                "text-center mb-6 p-4 rounded-xl",
                betState === "won" ? "bg-mint/20" : "bg-red-50"
              )}
            >
              <p className={clsx("text-2xl font-bold", betState === "won" ? "text-mint-dark" : "text-red-600")}>
                {betState === "won" ? "YOU WON! ✨" : "YOU LOST"}
              </p>
              {colorDisplay && (
                <p className="text-lg font-semibold mt-1 text-foreground/80">
                  Ball landed on {colorDisplay}
                </p>
              )}
              {betState === "won" && lastResult.payout > 0n && (
                <p className="text-lg text-mint-dark mt-1">
                  +{Number(formatEther(lastResult.payout)).toLocaleString(undefined, { maximumFractionDigits: 2 })} CLAW
                </p>
              )}
              <button onClick={handleReset} className="mt-3 px-5 py-2 btn-kawaii text-sm">
                Spin Again
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
                </div>
                <button
                  onClick={() => { setErrorMsg(null); setErrorDetails(null); setShowErrorDetails(false); }}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {errorDetails && errorDetails !== errorMsg && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowErrorDetails(!showErrorDetails)}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    {showErrorDetails ? "Hide details" : "Show details"}
                  </button>
                  {showErrorDetails && (
                    <pre className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                      {errorDetails}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status Messages */}
          {(betState === "placing" || betState === "waiting" || betState === "claiming") && (
            <p className="text-center mb-4 text-sm text-foreground/60">
              {betState === "placing" && "Placing bet..."}
              {betState === "waiting" && "Waiting for block..."}
              {betState === "claiming" && "Spinning the wheel..."}
            </p>
          )}

          {/* Bet Controls */}
          {!mounted ? (
            <div className="text-center py-6">
              <p className="text-foreground/60 text-sm">Loading...</p>
            </div>
          ) : !isConnected ? (
            <div className="text-center py-6">
              <p className="text-foreground/60 mb-2 text-sm">Connect wallet to play</p>
              <p className="text-foreground/40 mb-4 text-xs">Requires Base Sepolia testnet</p>
              <button
                onClick={() => openWalletModal()}
                className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-full font-bold transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : isWrongNetwork ? (
            <div className="text-center py-6">
              <p className="text-foreground/60 mb-2 text-sm">Wrong network detected</p>
              <p className="text-foreground/40 mb-4 text-xs">Please switch to Base Sepolia</p>
              <button
                onClick={() => switchChain?.({ chainId: 84532 })}
                disabled={isSwitching}
                className="px-6 py-3 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isSwitching ? "Switching..." : "Switch to Base Sepolia"}
              </button>
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
                    onChange={(e) => { setAmount(e.target.value); setSelectedPreset(null); }}
                    placeholder="0.0"
                    className="w-full bg-white/50 border border-primary/20 rounded-xl px-4 py-3 pr-28 text-lg font-mono focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <span className="text-foreground/50 text-sm">{useETH ? "ETH" : "CLAW"}</span>
                    <button
                      onClick={handleMax}
                      className="text-primary-dark hover:text-primary text-xs font-medium px-2 py-1 rounded bg-white/50 hover:bg-white/80 pointer-events-auto"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                {/* Amount Presets */}
                <div className="flex gap-2 mt-2">
                  {[10, 25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const balance = useETH
                          ? (ethBalance ? Number(ethBalance.formatted) : 0)
                          : (userTokenBalance ? Number(formatEther(userTokenBalance)) : 0);
                        let targetVal = balance * pct / 100;
                        if (useETH && pct === 100) targetVal = Math.max(0, targetVal - 0.001);
                        if (!useETH && maxBet) {
                          targetVal = Math.min(targetVal, Number(formatEther(maxBet)));
                        }
                        const truncated = targetVal >= 1 ? Math.floor(targetVal * 100) / 100
                          : targetVal >= 0.01 ? Math.floor(targetVal * 10000) / 10000
                          : Math.floor(targetVal * 1000000) / 1000000;
                        setAmount(truncated > 0 ? truncated.toString() : "0");
                        setSelectedPreset(pct);
                      }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${
                        selectedPreset === pct
                          ? "border-mint-dark bg-mint/20 text-mint-dark"
                          : "border-mint/30 hover:border-mint hover:bg-mint/10 text-foreground/70"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-foreground/50">
                    Balance:{" "}
                    {useETH
                      ? `${ethBalance ? Number(ethBalance.formatted).toFixed(4) : "0"} ETH`
                      : `${userTokenBalance ? Number(formatEther(userTokenBalance)).toLocaleString() : "0"} CLAW`}
                  </p>
                  {!useETH && (
                    <button
                      onClick={() => setSwapOpen(true)}
                      className="text-xs text-accent-dark hover:text-accent flex items-center gap-1"
                    >
                      <Coins className="w-3 h-3" />
                      Get CLAW
                    </button>
                  )}
                </div>
              </div>

              {/* Color Selection */}
              <div className="mb-4">
                <label className="text-xs text-foreground/60 mb-2 block">Choose Your Color</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setBetColor("red")}
                    className={colorButtonClass("red")}
                  >
                    <span className="w-4 h-4 rounded-full bg-red-600 border-2 border-red-800 inline-block" />
                    Red
                  </button>
                  <button
                    onClick={() => setBetColor("black")}
                    className={colorButtonClass("black")}
                  >
                    <span className="w-4 h-4 rounded-full bg-gray-900 border-2 border-gray-700 inline-block" />
                    Black
                  </button>
                </div>
              </div>

              {/* Odds & Payout Display */}
              <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-white/30 rounded-xl text-sm">
                <div>
                  <p className="text-foreground/60 text-xs">Win Chance</p>
                  <p className="font-bold text-primary-dark">{ROULETTE_WIN_CHANCE.toFixed(2)}%</p>
                  <p className="text-foreground/40 text-xs">18/37</p>
                </div>
                <div>
                  <p className="text-foreground/60 text-xs">Multiplier</p>
                  <p className="font-bold text-primary-dark">{ROULETTE_MULTIPLIER.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-foreground/60 text-xs">Win</p>
                  <p className="font-bold text-accent-dark">
                    {potentialPayout === 0 ? "0" : potentialPayout >= 1
                      ? potentialPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : potentialPayout.toFixed(4)} CLAW
                  </p>
                </div>
              </div>

              {/* Skip Wallet Popup Toggle */}
              {!useETH && (
                <div className="mb-4">
                  <button
                    onClick={async () => {
                      if (hasSession) {
                        setSkipWalletPopup(!skipWalletPopup);
                      } else if (!skipWalletPopup) {
                        const success = await createSession(24, parseEther("1000"));
                        if (success) setSkipWalletPopup(true);
                      } else {
                        setSkipWalletPopup(false);
                      }
                    }}
                    disabled={isCreatingSession}
                    className="w-full flex items-center justify-between p-3 bg-white/30 hover:bg-white/50 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {skipWalletPopup && hasSession ? (
                        <ToggleRight className="w-5 h-5 text-primary" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-foreground/40" />
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">
                          {isCreatingSession ? "Creating session..." : "Skip wallet popup"}
                        </p>
                        <p className="text-xs text-foreground/50">
                          {hasSession
                            ? skipWalletPopup
                              ? `Active for ${Math.floor(sessionTimeRemaining / 3600)}h ${Math.floor((sessionTimeRemaining % 3600) / 60)}m`
                              : "Session ready, click to enable"
                            : "Sign once, bet freely for 24h"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={clsx(
                        "w-10 h-6 rounded-full transition-colors flex items-center px-1",
                        skipWalletPopup && hasSession ? "bg-primary justify-end" : "bg-foreground/20 justify-start"
                      )}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </div>
                  </button>
                  {sessionError && <p className="text-xs text-red-500 mt-1">{sessionError}</p>}
                </div>
              )}

              {/* Action Buttons */}
              {needsApproval() ? (
                <button
                  onClick={handleApprove}
                  disabled={!amount || isApproving}
                  className="w-full btn-kawaii disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApproving ? "Approving..." : "Approve CLAW"}
                </button>
              ) : (
                <button
                  onClick={handlePlaceBet}
                  disabled={!amount || isPending || isConfirming || isCreatingSession}
                  className={clsx(
                    "w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                    betColor === "red"
                      ? "bg-red-600 hover:bg-red-700 shadow-md hover:shadow-red-200"
                      : "bg-gray-900 hover:bg-gray-800 shadow-md"
                  )}
                >
                  {isPending || isConfirming ? (
                    "Processing..."
                  ) : (
                    <>
                      <span
                        className={clsx(
                          "w-4 h-4 rounded-full border-2",
                          betColor === "red" ? "bg-white border-red-200" : "bg-gray-400 border-gray-600"
                        )}
                      />
                      Spin on {betColor === "red" ? "Red" : "Black"}
                    </>
                  )}
                </button>
              )}
            </>
          ) : null}
        </div>

        {/* Get CLAW Callout */}
        {mounted && isConnected && userTokenBalance !== undefined && userTokenBalance < parseEther("1") && (
          <button
            onClick={() => setSwapOpen(true)}
            className="card-kawaii p-4 mt-4 flex items-center justify-between hover:bg-white/80 transition-colors w-full text-left"
          >
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-accent-dark" />
              <div>
                <p className="font-semibold text-foreground text-sm">Need CLAW tokens?</p>
                <p className="text-xs text-foreground/60">Swap ETH for CLAW instantly</p>
              </div>
            </div>
            <span className="text-xs text-accent-dark font-medium">Swap →</span>
          </button>
        )}

        {/* Swap Modal */}
        <SwapModal isOpen={swapOpen} onClose={() => setSwapOpen(false)} />

        {/* Roulette Info Box */}
        <div className="card-kawaii p-4 mt-4 flex gap-3">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs text-foreground/60 space-y-1">
            <p>
              European single-zero roulette. Red and black each cover{" "}
              <span className="font-semibold">18/37 ≈ 48.65%</span> of the wheel.
            </p>
            <p>
              The wheel is reverse-engineered to land on the correct color after each spin.
              Result determined by next block&apos;s hash. 1% house edge. Claim within 255 blocks.
            </p>
          </div>
        </div>
      </div>

      <UserHistory isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
