"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useBalance, useChainId, useSwitchChain } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther, parseEther, decodeEventLog } from "viem";
import { Volume2, VolumeX, Info, Zap, Coins, ChevronDown, Play, Settings, Bot } from "lucide-react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { CONTRACTS, CLAWDICE_ABI, ERC20_ABI } from "@/lib/contracts";
import { SwapModal } from "@/components/SwapModal";
import { SpinWheel } from "@/components/SpinWheel";
import { useSponsoredClaim } from "@/hooks/useSponsoredClaim";
import { useAutoReveal } from "@/hooks/useAutoReveal";
import { useSessionKey } from "@/hooks/useSessionKey";
import clsx from "clsx";
import { X, Check, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";

type BetState = "idle" | "placing" | "waiting" | "claiming" | "won" | "lost";

type BetStrategy = "flat" | "martingale" | "antiMartingale" | "fibonacci" | "dalembert" | "kelly";

interface AutoBetConfig {
  strategy: BetStrategy;
  baseBet: string;
  maxBet: string;
  stopOnProfit: string;
  stopOnLoss: string;
  numberOfBets: number;
  resetOnWin: boolean;
  resetOnLoss: boolean;
}

export default function PlayPage() {
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
  const isWrongNetwork = isConnected && chainId !== 84532; // Base Sepolia
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [odds, setOdds] = useState(50);
  const [betState, setBetState] = useState<BetState>("idle");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: bigint; resultPosition?: number } | null>(null);
  const [currentBetId, setCurrentBetId] = useState<bigint | null>(null);
  const [resultPosition, setResultPosition] = useState<number | null>(null);
  const [useETH, setUseETH] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const spinnerRef = useRef<HTMLDivElement>(null);
  
  // Approval state (separate from bet state)
  const [isApproving, setIsApproving] = useState(false);
  
  // Advanced & Auto mode state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAuto, setShowAuto] = useState(false);
  const [directOddsInput, setDirectOddsInput] = useState("");
  const [autoBetRunning, setAutoBetRunning] = useState(false);
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>({
    strategy: "flat",
    baseBet: "",
    maxBet: "",
    stopOnProfit: "",
    stopOnLoss: "",
    numberOfBets: 10,
    resetOnWin: false,
    resetOnLoss: true,
  });
  const [autoBetStats, setAutoBetStats] = useState({ betsPlaced: 0, wins: 0, losses: 0, profit: BigInt(0) });
  
  // Session key / skip wallet popup - sync with localStorage and session state
  const [skipWalletPopup, setSkipWalletPopup] = useState(false);
  
  // Debug: log session state changes
  useEffect(() => {
    console.log("[PlayPage] Session state changed:", { hasSession, skipWalletPopup, isCreatingSession, sessionError });
  }, [hasSession, skipWalletPopup, isCreatingSession, sessionError]);
  
  // Load skipWalletPopup preference from localStorage and sync with session state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("clawdice_skip_wallet_popup");
    console.log("[PlayPage] Loading skipWalletPopup preference:", { stored, hasSession });
    
    if (stored === "true" && hasSession) {
      console.log("[PlayPage] Restoring skipWalletPopup=true (stored + hasSession)");
      setSkipWalletPopup(true);
    } else if (hasSession && stored !== "false") {
      // Session exists but preference not explicitly set to false - default to using it
      console.log("[PlayPage] Session exists, defaulting skipWalletPopup=true");
      setSkipWalletPopup(true);
      localStorage.setItem("clawdice_skip_wallet_popup", "true");
    }
  }, [hasSession]);
  
  // Persist preference changes (but not on initial mount)
  const [didMount, setDidMount] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!didMount) {
      setDidMount(true);
      return;
    }
    console.log("[PlayPage] Persisting skipWalletPopup:", skipWalletPopup);
    localStorage.setItem("clawdice_skip_wallet_popup", skipWalletPopup ? "true" : "false");
  }, [skipWalletPopup, didMount]);

  // Scroll to spinner when bet starts
  const scrollToSpinner = useCallback(() => {
    spinnerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Read user token balance
  const { data: userTokenBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.baseSepolia.clawToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read ETH balance
  const { data: ethBalance } = useBalance({
    address,
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

  // Refetch balance when auto-reveals complete
  useEffect(() => {
    if (revealedBets.length > 0) {
      refetchBalance();
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    }
  }, [revealedBets.length, refetchBalance, queryClient]);

  // Write functions
  const { writeContract, writeContractAsync, data: txHash, isPending, reset: resetWrite, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt, error: txError } = useWaitForTransactionReceipt({ hash: txHash });

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

  // Parse error message for user-friendly display
  const parseErrorMessage = (err: Error | null): { msg: string; details: string } => {
    if (!err) return { msg: "Unknown error", details: "" };
    
    const fullMessage = err.message || String(err);
    
    // User rejected
    if (fullMessage.includes("user rejected") || fullMessage.includes("User denied")) {
      return { msg: "Transaction cancelled", details: "" };
    }
    
    // Insufficient balance
    if (fullMessage.includes("insufficient") || fullMessage.includes("exceeds balance")) {
      return { msg: "Insufficient balance", details: fullMessage };
    }
    
    // Contract revert reasons
    const revertMatch = fullMessage.match(/reverted with reason string '([^']+)'/);
    if (revertMatch) {
      return { msg: revertMatch[1], details: fullMessage };
    }
    
    // Custom error
    const customErrorMatch = fullMessage.match(/reverted with custom error '([^']+)'/);
    if (customErrorMatch) {
      return { msg: `Contract error: ${customErrorMatch[1]}`, details: fullMessage };
    }
    
    // Extract short message from long error
    const shortMsgMatch = fullMessage.match(/^([^.!?\n]{1,100}[.!?]?)/);
    const shortMsg = shortMsgMatch ? shortMsgMatch[1] : "Transaction failed";
    
    return { msg: shortMsg, details: fullMessage };
  };

  // Compute result position from blockhash (replicates contract logic)
  const computeResultPosition = useCallback(async (betId: bigint, betBlockNumber: bigint): Promise<number> => {
    if (!publicClient) return 50; // Fallback
    
    try {
      const resultBlock = betBlockNumber + BigInt(1);
      const block = await publicClient.getBlock({ blockNumber: resultBlock });
      
      if (!block?.hash) return 50;
      
      // Replicate: keccak256(abi.encodePacked(betId, blockhash))
      const { keccak256, encodePacked } = await import("viem");
      const randomResult = BigInt(keccak256(encodePacked(["uint256", "bytes32"], [betId, block.hash])));
      
      // Scale to 0-100 range (same as contract)
      const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      const E18 = BigInt("1000000000000000000");
      const scaleFactor = MAX_UINT256 / E18;
      const scaledResult = randomResult / scaleFactor;
      
      // Convert to percentage
      return Number((scaledResult * BigInt(10000)) / E18) / 100;
    } catch (err) {
      console.error("Failed to compute result position:", err);
      return 50;
    }
  }, [publicClient]);

  // Handle transaction errors - reset state
  useEffect(() => {
    if (writeError || txError) {
      console.error("Transaction error:", writeError || txError);
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

  // Handle transaction success (for bet placing/claiming only - approval handled separately)
  useEffect(() => {
    if (isSuccess && receipt) {
      if (betState === "placing") {
        const betId = parseBetId(receipt);
        if (betId) {
          setCurrentBetId(betId);
          setBetState("waiting");
          // isRolling already true from handlePlaceBet
        }
      } else if (betState === "claiming") {
        // Check if this was our bet before showing success screen
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
          } catch {}
        }
        
        if (isOurBet) {
          const result = parseResult(receipt);
          if (result) {
            setLastResult(result);
            setBetState(result.won ? "won" : "lost");
            setIsRolling(false);
            refetchBalance();
          }
        } else {
          // Not our bet - silently reset
          console.log("Claimed bet belongs to another player");
          setBetState("idle");
          setIsRolling(false);
        }
      }
    }
  }, [isSuccess, receipt, betState, parseBetId, parseResult, queryClient, refetchBalance, refetchAllowance, resetWrite, address]);

  // Wait for next block then claim (try sponsored first, fall back to regular)
  useEffect(() => {
    if (betState === "waiting" && currentBetId && publicClient) {
      const waitAndClaim = async () => {
        // Get the bet's block number with retry (RPC may not have synced yet)
        let betBlockNumber: bigint | null = null;
        
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const betData = await publicClient.readContract({
              address: CONTRACTS.baseSepolia.clawdice,
              abi: CLAWDICE_ABI,
              functionName: "getBet",
              args: [currentBetId],
            });
            
            const bet = betData as { 
              player: `0x${string}`; 
              amount: bigint; 
              targetOddsE18: bigint; 
              blockNumber: bigint; 
              status: number;
            };
            
            if (bet.blockNumber && bet.blockNumber > BigInt(0)) {
              betBlockNumber = bet.blockNumber;
              console.log("Bet data fetched:", { 
                blockNumber: bet.blockNumber.toString(), 
                attempt: attempt + 1 
              });
              break;
            }
            
            // Bet not synced yet, wait and retry
            console.log(`Bet not synced yet (attempt ${attempt + 1}/5), waiting 1s...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Error fetching bet (attempt ${attempt + 1}):`, err);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
        
        // Wait for result block
        try {
          if (betBlockNumber) {
            const targetBlock = betBlockNumber + BigInt(1);
            console.log("Waiting for block", targetBlock.toString());
          
            // Poll until we're past the target block
            let currentBlock = await publicClient.getBlockNumber();
            while (currentBlock <= targetBlock) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              currentBlock = await publicClient.getBlockNumber();
              console.log("Current block:", currentBlock.toString());
            }
            console.log("Block ready, proceeding with claim");
          } else {
            // Couldn't get bet data after retries, use fallback delay
            console.warn("Could not fetch bet data, using 3s fallback delay");
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (err) {
          console.error("Error waiting for block:", err);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        setBetState("claiming");
        
        // Try sponsored claim first (free for user)
        console.log("Attempting sponsored claim for bet", currentBetId.toString());
        const sponsoredTxHash = await sponsoredClaim(currentBetId);
        
        if (sponsoredTxHash) {
          console.log("Sponsored claim submitted:", sponsoredTxHash);
          // Wait for the sponsored tx to be mined
          try {
            const receipt = await publicClient.waitForTransactionReceipt({ 
              hash: sponsoredTxHash,
              timeout: 60000,
            });
            console.log("Sponsored claim confirmed:", receipt.status);
            
            // Parse result from receipt - check if this bet was ours
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: CLAWDICE_ABI,
                  data: log.data,
                  topics: log.topics,
                });
                // Check BetClaimed event which has the player address
                if (decoded.eventName === "BetClaimed") {
                  const { player, payout } = decoded.args as { betId: bigint; player: `0x${string}`; payout: bigint };
                  // Only show success if this was our bet
                  if (player.toLowerCase() === address?.toLowerCase()) {
                    // Compute result position for visualization
                    const betInfo = await publicClient.readContract({
                      address: CONTRACTS.baseSepolia.clawdice,
                      abi: CLAWDICE_ABI,
                      functionName: "getBet",
                      args: [currentBetId],
                    }) as { blockNumber: bigint };
                    const position = await computeResultPosition(currentBetId, betInfo.blockNumber);
                    setResultPosition(position);
                    setLastResult({ won: true, payout, resultPosition: position });
                    setBetState("won");
                    setIsRolling(false);
                    refetchBalance();
                    return;
                  } else {
                    // Not our bet - just reset state silently
                    console.log("Revealed bet for another player:", player);
                    setBetState("idle");
                    setIsRolling(false);
                    setResultPosition(null);
                    return;
                  }
                }
                if (decoded.eventName === "BetResolved") {
                  const { won } = decoded.args as { won: boolean; payout: bigint };
                  // If it was a loss, BetClaimed won't fire, but BetResolved will
                  // For losses, we still want to show the result if it was our bet
                  if (!won) {
                    // Check if this bet was ours by reading bet data
                    const betData = await publicClient.readContract({
                      address: CONTRACTS.baseSepolia.clawdice,
                      abi: CLAWDICE_ABI,
                      functionName: "getBet",
                      args: [currentBetId],
                    }) as { player: `0x${string}`; blockNumber: bigint };
                    
                    if (betData.player.toLowerCase() === address?.toLowerCase()) {
                      // Compute result position for visualization
                      const position = await computeResultPosition(currentBetId, betData.blockNumber);
                      setResultPosition(position);
                      setLastResult({ won: false, payout: BigInt(0), resultPosition: position });
                      setBetState("lost");
                      setIsRolling(false);
                      refetchBalance();
                    } else {
                      console.log("Revealed losing bet for another player");
                      setBetState("idle");
                      setIsRolling(false);
                      setResultPosition(null);
                    }
                    return;
                  }
                }
              } catch {}
            }
          } catch (err) {
            console.error("Sponsored claim tx failed:", err);
          }
        }
        
        // Fall back to regular claim if sponsored fails
        console.log("Falling back to regular claim");
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
  }, [betState, currentBetId, publicClient, sponsoredClaim, writeContract, resetWrite, refetchBalance, address, computeResultPosition]);

  const needsApproval = useCallback(() => {
    if (useETH) return false;
    // Only show approval if user has entered an amount that exceeds allowance
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
      // Approve unlimited so user only needs to do this once
      const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      const hash = await writeContractAsync({
        address: CONTRACTS.baseSepolia.clawToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.baseSepolia.clawdice, MAX_UINT256],
      });

      // Wait for tx confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === "success") {
        // Poll until allowance is updated (RPC sync lag)
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000));
          const { data: newAllowance } = await refetchAllowance();
          if (newAllowance && newAllowance > BigInt(0)) {
            console.log("[Approve] Allowance updated:", newAllowance.toString());
            break;
          }
          attempts++;
          console.log("[Approve] Polling allowance, attempt", attempts);
        }
        queryClient.invalidateQueries({ queryKey: ["readContract"] });
      }
    } catch (err) {
      console.error("[Approve] Error:", err);
      const msg = err instanceof Error ? err.message : "Approval failed";
      if (!msg.includes("rejected")) {
        setErrorMsg(msg);
      }
    } finally {
      setIsApproving(false);
      resetWrite();
    }
  };

  const handlePlaceBet = async () => {
    if (!address || !amount) return;

    setBetState("placing");
    setIsRolling(true);
    setErrorMsg(null);
    scrollToSpinner();

    // Use session key for gasless betting (skip wallet popup)
    if (skipWalletPopup && hasSession && !useETH) {
      try {
        const txHash = await placeBetWithSession(
          parseEther(amount),
          BigInt(odds) * BigInt(10 ** 16)
        );
        
        if (txHash && publicClient) {
          // Wait for the transaction and parse the bet ID
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          
          if (receipt.status === "success") {
            // Parse BetPlaced event to get bet ID
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: CLAWDICE_ABI,
                  data: log.data,
                  topics: log.topics,
                });
                if (decoded.eventName === "BetPlaced" || decoded.eventName === "BetPlacedViaSession") {
                  const betId = (decoded.args as { betId: bigint }).betId;
                  setCurrentBetId(betId);
                  setBetState("waiting");
                  return;
                }
              } catch {
                // Not our event
              }
            }
          }
          
          throw new Error("Could not find bet ID in transaction");
        }
      } catch (err) {
        console.error("Session bet failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Session bet failed";
        setErrorMsg(errorMessage);
        setBetState("idle");
        setIsRolling(false);
        return;
      }
    }

    // Normal flow - user signs each transaction
    if (useETH) {
      // Place bet with ETH (atomic swap) - needs higher gas for Uniswap V4 swap
      writeContract({
        address: CONTRACTS.baseSepolia.clawdice,
        abi: CLAWDICE_ABI,
        functionName: "placeBetWithETH",
        args: [BigInt(odds) * BigInt(10 ** 16), BigInt(0)], // 0 minTokensOut for simplicity
        value: parseEther(amount),
        gas: BigInt(500_000), // Fixed gas limit - swap + bet is gas-heavy
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
    setResultPosition(null);
    setCurrentBetId(null);
    setSelectedPreset(null);
    resetWrite();
  };

  const handleMax = () => {
    setSelectedPreset(null);
    if (useETH) {
      // For ETH, leave some for gas
      if (ethBalance) {
        const max = Math.max(0, Number(ethBalance.formatted) - 0.001);
        setAmount(max.toFixed(6));
      }
    } else {
      // For CLAW, use min of balance and maxBet
      if (userTokenBalance && maxBet) {
        const maxAllowed = userTokenBalance < maxBet ? userTokenBalance : maxBet;
        setAmount(formatEther(maxAllowed));
      }
    }
  };

  return (
    <div className="min-h-screen bg-kawaii py-8 pt-20">
      {/* Auto-reveal Toasts */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {/* Revealing in progress */}
        {revealingBets.size > 0 && (
          <div className="glass rounded-xl p-3 flex items-center gap-3 shadow-lg animate-pulse">
            <Zap className="w-5 h-5 text-accent animate-pulse" />
            <span className="text-sm text-foreground">
              Revealing {revealingBets.size} pending bet{revealingBets.size > 1 ? "s" : ""}...
            </span>
          </div>
        )}
        
        {/* Revealed results */}
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
            <button 
              onClick={() => clearRevealed(result.betId)}
              className="p-1 hover:bg-white/50 rounded"
            >
              <X className="w-4 h-4 text-foreground/50" />
            </button>
          </div>
        ))}
      </div>

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
          {/* Spin Wheel Display */}
          <div ref={spinnerRef} className="flex justify-center mb-6">
            <SpinWheel
              winChance={odds}
              houseEdge={1}
              isSpinning={isRolling}
              resultPosition={resultPosition}
              size={180}
              onSpinComplete={() => setIsRolling(false)}
            />
          </div>

          {/* Result Display - only show after wheel stops */}
          {(betState === "won" || betState === "lost") && lastResult && !isRolling && (
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
                  +{(() => {
                    const val = Number(formatEther(lastResult.payout));
                    if (val >= 1) return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    if (val >= 0.01) return val.toFixed(4);
                    if (val >= 0.0001) return val.toFixed(6);
                    return val.toFixed(8);
                  })()} CLAW
                </p>
              )}
              {lastResult.resultPosition !== undefined && (
                <p className="text-sm text-foreground/60 mt-2">
                  Result: {lastResult.resultPosition.toFixed(2)}% 
                  {betState === "won" 
                    ? ` < ${(odds * 0.99).toFixed(2)}% threshold` 
                    : ` ≥ ${(odds * 0.99).toFixed(2)}% threshold`}
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

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
                </div>
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setErrorDetails(null);
                    setShowErrorDetails(false);
                  }}
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

          {/* Status Messages - minimal text only, spinner provides visual feedback */}
          {(betState === "placing" || betState === "waiting" || betState === "claiming") && (
            <p className="text-center mb-4 text-sm text-foreground/60">
              {betState === "placing" && "Placing bet..."}
              {betState === "waiting" && "Waiting for block..."}
              {betState === "claiming" && "Revealing..."}
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
                    className="w-full bg-white/50 border border-primary/20 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:border-primary"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-foreground/50 text-sm">{useETH ? "ETH" : "CLAW"}</span>
                    <button
                      onClick={handleMax}
                      className="text-primary-dark hover:text-primary text-xs font-medium"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                {/* Amount Preset Buttons - accent colored to differentiate from odds presets */}
                <div className="flex gap-2 mt-2">
                  {[10, 25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const balance = useETH 
                          ? (ethBalance ? Number(ethBalance.formatted) : 0)
                          : (userTokenBalance ? Number(formatEther(userTokenBalance)) : 0);
                        let targetVal = (balance * pct / 100);
                        if (useETH && pct === 100) targetVal = Math.max(0, targetVal - 0.001);
                        if (!useETH && maxBet) {
                          const maxBetNum = Number(formatEther(maxBet));
                          targetVal = Math.min(targetVal, maxBetNum);
                        }
                        const formatVal = (v: number) => {
                          if (v === 0) return "0";
                          if (v >= 1) return v.toFixed(2);
                          if (v >= 0.01) return v.toFixed(4);
                          if (v >= 0.0001) return v.toFixed(6);
                          return v.toFixed(8);
                        };
                        setAmount(targetVal > 0 ? formatVal(targetVal) : "0");
                        setSelectedPreset(pct);
                      }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${
                        selectedPreset === pct
                          ? "border-accent bg-accent/20 text-accent-dark"
                          : "border-accent/30 hover:border-accent hover:bg-accent/10 text-foreground/70"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-foreground/50">
                    Balance: {useETH 
                      ? `${ethBalance ? Number(ethBalance.formatted).toFixed(4) : "0"} ETH`
                      : `${userTokenBalance ? Number(formatEther(userTokenBalance)).toLocaleString() : "0"} CLAW`
                    }
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
                  className="w-full accent-primary"
                />
                {/* Odds Preset Buttons */}
                <div className="flex gap-2 mt-2">
                  {[10, 25, 50, 75, 90].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setOdds(pct)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${
                        odds === pct 
                          ? "border-primary bg-primary/10 text-primary-dark" 
                          : "border-foreground/20 hover:border-primary/50 text-foreground/70"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs mt-2 text-foreground/50">
                  <span>High risk</span>
                  <span>Low risk</span>
                </div>
              </div>

              {/* Multiplier & Payout Display */}
              <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-white/30 rounded-xl text-sm">
                <div>
                  <p className="text-foreground/60 text-xs">Multiplier</p>
                  <p className="font-bold text-primary-dark">{multiplier.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-foreground/60 text-xs">Win</p>
                  <p className="font-bold text-accent-dark">
                    {(() => {
                      if (potentialPayout === 0) return "0";
                      if (potentialPayout >= 1) return potentialPayout.toLocaleString(undefined, { maximumFractionDigits: 2 });
                      if (potentialPayout >= 0.01) return potentialPayout.toFixed(4);
                      if (potentialPayout >= 0.0001) return potentialPayout.toFixed(6);
                      return potentialPayout.toFixed(8);
                    })()} CLAW
                  </p>
                </div>
              </div>

              {/* Skip Wallet Popup Toggle */}
              {!useETH && (
                <div className="mb-4">
                  <button
                    onClick={async () => {
                      console.log("[PlayPage] Toggle clicked:", { hasSession, skipWalletPopup });
                      if (hasSession) {
                        // Session exists - just toggle the preference
                        console.log("[PlayPage] Session exists, toggling preference to:", !skipWalletPopup);
                        setSkipWalletPopup(!skipWalletPopup);
                      } else if (!skipWalletPopup) {
                        // No session, turning on - create session first
                        console.log("[PlayPage] No session, creating new session...");
                        const success = await createSession(24, parseEther("1000"));
                        console.log("[PlayPage] createSession returned:", success);
                        if (success) {
                          console.log("[PlayPage] Setting skipWalletPopup=true after success");
                          setSkipWalletPopup(true);
                        }
                      } else {
                        // No session but toggle is on (shouldn't happen) - turn off
                        console.log("[PlayPage] Inconsistent state, turning off");
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
                            ? (skipWalletPopup 
                                ? `Active for ${Math.floor(sessionTimeRemaining / 3600)}h ${Math.floor((sessionTimeRemaining % 3600) / 60)}m`
                                : "Session ready, click to enable")
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
                  {sessionError && (
                    <p className="text-xs text-red-500 mt-1">{sessionError}</p>
                  )}
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
                  className="w-full btn-accent rounded-full py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  {isPending || isConfirming ? "Processing..." : "Spin to Win"}
                </button>
              )}

              {/* Advanced Section - Collapsible */}
              <div className="mt-6 border-t border-foreground/10 pt-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Advanced
                  </span>
                  <ChevronDown className={clsx("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Direct Win Chance Input */}
                    <div>
                      <label className="text-xs text-foreground/60 mb-1 block">Win Chance (%)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={directOddsInput || odds}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDirectOddsInput(val);
                            const num = parseFloat(val);
                            if (!isNaN(num) && num >= 0.01 && num <= 99) {
                              setOdds(Math.round(num));
                            }
                          }}
                          onBlur={() => {
                            const num = parseFloat(directOddsInput);
                            if (!isNaN(num)) {
                              const clamped = Math.min(99, Math.max(0.01, num));
                              setOdds(Math.round(clamped));
                              setDirectOddsInput("");
                            }
                          }}
                          step="0.01"
                          min="0.01"
                          max="99"
                          className="flex-1 bg-white/50 border border-primary/20 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => setOdds(Math.min(99, odds + 1))}
                          className="px-3 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium text-primary-dark"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => setOdds(Math.max(1, odds - 1))}
                          className="px-3 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium text-primary-dark"
                        >
                          −1
                        </button>
                      </div>
                    </div>

                    {/* Bet Size Multipliers */}
                    <div>
                      <label className="text-xs text-foreground/60 mb-1 block">Quick Bet Adjust</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const current = parseFloat(amount) || 0;
                            setAmount(Math.max(0.0001, current / 2).toString());
                            setSelectedPreset(null);
                          }}
                          className="flex-1 py-2 px-3 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-sm font-medium text-foreground/70"
                        >
                          ½
                        </button>
                        <button
                          onClick={() => {
                            const current = parseFloat(amount) || 0;
                            const doubled = current * 2;
                            const maxAllowed = maxBet ? Number(formatEther(maxBet)) : doubled;
                            setAmount(Math.min(doubled, maxAllowed).toString());
                            setSelectedPreset(null);
                          }}
                          className="flex-1 py-2 px-3 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-sm font-medium text-foreground/70"
                        >
                          2×
                        </button>
                        <button
                          onClick={() => {
                            setAmount("0");
                            setSelectedPreset(null);
                          }}
                          className="flex-1 py-2 px-3 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-sm font-medium text-foreground/70"
                        >
                          Min
                        </button>
                        <button
                          onClick={handleMax}
                          className="flex-1 py-2 px-3 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-sm font-medium text-foreground/70"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto Bet Section - Collapsible */}
              <div className="mt-4 border-t border-foreground/10 pt-4">
                <button
                  onClick={() => setShowAuto(!showAuto)}
                  className="w-full flex items-center justify-between text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Auto Bet
                  </span>
                  <ChevronDown className={clsx("w-4 h-4 transition-transform", showAuto && "rotate-180")} />
                </button>
                
                {showAuto && (
                  <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Strategy Selector */}
                    <div>
                      <label className="text-xs text-foreground/60 mb-1 block">Strategy</label>
                      <select
                        value={autoBetConfig.strategy}
                        onChange={(e) => setAutoBetConfig({ ...autoBetConfig, strategy: e.target.value as BetStrategy })}
                        className="w-full bg-white/50 border border-primary/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="flat">Flat (Same bet every time)</option>
                        <option value="martingale">Martingale (2× after loss)</option>
                        <option value="antiMartingale">Anti-Martingale (2× after win)</option>
                        <option value="fibonacci">Fibonacci (Sequence progression)</option>
                        <option value="dalembert">D&apos;Alembert (+1 loss, −1 win)</option>
                        <option value="kelly">Kelly Criterion (Optimal sizing)</option>
                      </select>
                      <p className="text-xs text-foreground/50 mt-1">
                        {autoBetConfig.strategy === "flat" && "Bet the same amount every time. Safest approach."}
                        {autoBetConfig.strategy === "martingale" && "Double bet after loss, reset after win. High risk."}
                        {autoBetConfig.strategy === "antiMartingale" && "Double bet after win, reset after loss. Ride winning streaks."}
                        {autoBetConfig.strategy === "fibonacci" && "Follow Fibonacci sequence (1,1,2,3,5,8...) for bet sizes."}
                        {autoBetConfig.strategy === "dalembert" && "Increase by 1 unit after loss, decrease by 1 after win."}
                        {autoBetConfig.strategy === "kelly" && "Bet optimal fraction based on edge and bankroll."}
                      </p>
                    </div>

                    {/* Base Bet & Max Bet */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-foreground/60 mb-1 block">Base Bet</label>
                        <input
                          type="number"
                          value={autoBetConfig.baseBet}
                          onChange={(e) => setAutoBetConfig({ ...autoBetConfig, baseBet: e.target.value })}
                          placeholder="0.1"
                          className="w-full bg-white/50 border border-primary/20 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-foreground/60 mb-1 block">Max Bet</label>
                        <input
                          type="number"
                          value={autoBetConfig.maxBet}
                          onChange={(e) => setAutoBetConfig({ ...autoBetConfig, maxBet: e.target.value })}
                          placeholder="10"
                          className="w-full bg-white/50 border border-primary/20 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* Stop Conditions */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-foreground/60 mb-1 block">Stop on Profit</label>
                        <input
                          type="number"
                          value={autoBetConfig.stopOnProfit}
                          onChange={(e) => setAutoBetConfig({ ...autoBetConfig, stopOnProfit: e.target.value })}
                          placeholder="100"
                          className="w-full bg-white/50 border border-primary/20 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-foreground/60 mb-1 block">Stop on Loss</label>
                        <input
                          type="number"
                          value={autoBetConfig.stopOnLoss}
                          onChange={(e) => setAutoBetConfig({ ...autoBetConfig, stopOnLoss: e.target.value })}
                          placeholder="50"
                          className="w-full bg-white/50 border border-primary/20 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* Number of Bets */}
                    <div>
                      <label className="text-xs text-foreground/60 mb-1 block">Number of Bets</label>
                      <input
                        type="number"
                        value={autoBetConfig.numberOfBets}
                        onChange={(e) => setAutoBetConfig({ ...autoBetConfig, numberOfBets: parseInt(e.target.value) || 0 })}
                        placeholder="10"
                        min="1"
                        max="1000"
                        className="w-full bg-white/50 border border-primary/20 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                      />
                    </div>

                    {/* Reset Options */}
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-foreground/70">
                        <input
                          type="checkbox"
                          checked={autoBetConfig.resetOnWin}
                          onChange={(e) => setAutoBetConfig({ ...autoBetConfig, resetOnWin: e.target.checked })}
                          className="rounded border-foreground/20"
                        />
                        Reset on Win
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground/70">
                        <input
                          type="checkbox"
                          checked={autoBetConfig.resetOnLoss}
                          onChange={(e) => setAutoBetConfig({ ...autoBetConfig, resetOnLoss: e.target.checked })}
                          className="rounded border-foreground/20"
                        />
                        Reset on Loss
                      </label>
                    </div>

                    {/* Auto Bet Stats */}
                    {(autoBetStats.betsPlaced > 0 || autoBetRunning) && (
                      <div className="p-3 bg-white/30 rounded-xl text-sm">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-foreground/60 text-xs">Bets</p>
                            <p className="font-bold">{autoBetStats.betsPlaced}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60 text-xs">Wins</p>
                            <p className="font-bold text-mint-dark">{autoBetStats.wins}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60 text-xs">Losses</p>
                            <p className="font-bold text-claw">{autoBetStats.losses}</p>
                          </div>
                          <div>
                            <p className="text-foreground/60 text-xs">Profit</p>
                            <p className={clsx("font-bold", autoBetStats.profit >= 0 ? "text-mint-dark" : "text-claw")}>
                              {autoBetStats.profit >= 0 ? "+" : ""}{Number(formatEther(autoBetStats.profit)).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Start/Stop Auto Bet */}
                    <button
                      onClick={() => {
                        if (autoBetRunning) {
                          setAutoBetRunning(false);
                        } else {
                          // TODO: Implement auto-bet loop
                          setAutoBetRunning(true);
                          setAutoBetStats({ betsPlaced: 0, wins: 0, losses: 0, profit: BigInt(0) });
                        }
                      }}
                      disabled={!autoBetConfig.baseBet || autoBetConfig.numberOfBets < 1}
                      className={clsx(
                        "w-full py-3 rounded-full font-bold transition-colors flex items-center justify-center gap-2",
                        autoBetRunning
                          ? "bg-claw text-white hover:bg-claw/90"
                          : "bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {autoBetRunning ? (
                        <>
                          <Play className="w-4 h-4" />
                          Stop Auto Bet
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Start Auto Bet
                        </>
                      )}
                    </button>

                    <p className="text-xs text-foreground/50 text-center">
                      ⚠️ Auto-betting can result in significant losses. Gamble responsibly.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Get CLAW Callout - show when connected but low balance */}
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

        {/* Info Box */}
        <div className="card-kawaii p-4 mt-4 flex gap-3">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/60">
            Result determined by next block&apos;s hash. 1% house edge. Claim within 255 blocks (~8.5 min).
            {useETH && " ETH is swapped to CLAW atomically via Uniswap V4 (requires pool liquidity)."}
          </p>
        </div>
      </div>
    </div>
  );
}
