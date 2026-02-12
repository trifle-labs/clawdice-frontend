"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { decodeEventLog } from "viem";
import { getBetsByPlayer, BetEvent } from "@/lib/indexer";
import { useSponsoredClaim } from "./useSponsoredClaim";
import { CLAWDICE_ABI } from "@/lib/contracts";

interface RevealResult {
  betId: string;
  won: boolean;
  payout: bigint;
}

export function useAutoReveal() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { sponsoredClaim, isReady } = useSponsoredClaim();
  
  const [pendingBets, setPendingBets] = useState<BetEvent[]>([]);
  const [revealingBets, setRevealingBets] = useState<Set<string>>(new Set());
  const [revealedBets, setRevealedBets] = useState<RevealResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const hasCheckedRef = useRef(false);

  // Check for pending bets that can be revealed
  const checkAndReveal = useCallback(async () => {
    if (!address || !publicClient || !isReady || isChecking) return;
    if (hasCheckedRef.current) return; // Only check once per session
    
    setIsChecking(true);
    hasCheckedRef.current = true;
    
    try {
      // Get user's bets from indexer
      const userBets = await getBetsByPlayer(address);
      
      // Filter to pending bets (no resolution, not expired)
      const pending = userBets.filter(bet => 
        bet.won === undefined && !bet.expired
      );
      
      if (pending.length === 0) {
        setIsChecking(false);
        return;
      }
      
      setPendingBets(pending);
      
      // Get current block
      const currentBlock = await publicClient.getBlockNumber();
      
      // For each pending bet, check if it can be revealed
      for (const bet of pending) {
        const resultBlock = BigInt(bet.blockNumber) + 1n;
        
        // Can only reveal after result block
        if (currentBlock <= resultBlock) {
          console.log(`Bet ${bet.betId} not ready yet (current: ${currentBlock}, need: ${resultBlock + 1n})`);
          continue;
        }
        
        // Mark as revealing
        setRevealingBets(prev => new Set(prev).add(bet.betId));
        
        console.log(`Auto-revealing bet ${bet.betId}...`);
        
        try {
          const txHash = await sponsoredClaim(BigInt(bet.betId));
          
          if (txHash) {
            // Wait for receipt
            const receipt = await publicClient.waitForTransactionReceipt({ 
              hash: txHash,
              timeout: 60000,
            });
            
            // Parse result
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: CLAWDICE_ABI,
                  data: log.data,
                  topics: log.topics,
                });
                if (decoded.eventName === "BetResolved") {
                  const { won, payout } = decoded.args as { won: boolean; payout: bigint };
                  setRevealedBets(prev => [...prev, { 
                    betId: bet.betId, 
                    won, 
                    payout 
                  }]);
                  break;
                }
              } catch {
                // Not our event
              }
            }
          }
        } catch (err) {
          console.error(`Failed to reveal bet ${bet.betId}:`, err);
        } finally {
          setRevealingBets(prev => {
            const next = new Set(prev);
            next.delete(bet.betId);
            return next;
          });
          setPendingBets(prev => prev.filter(b => b.betId !== bet.betId));
        }
      }
    } catch (err) {
      console.error("Auto-reveal check failed:", err);
    } finally {
      setIsChecking(false);
    }
  }, [address, publicClient, isReady, isChecking, sponsoredClaim]);

  // Check on mount when ready
  useEffect(() => {
    if (isConnected && isReady && !hasCheckedRef.current) {
      // Small delay to let page render first
      const timer = setTimeout(checkAndReveal, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isReady, checkAndReveal]);

  // Reset check flag when address changes
  useEffect(() => {
    hasCheckedRef.current = false;
  }, [address]);

  // Clear revealed bets after displaying
  const clearRevealed = useCallback((betId: string) => {
    setRevealedBets(prev => prev.filter(b => b.betId !== betId));
  }, []);

  return {
    pendingBets,
    revealingBets,
    revealedBets,
    isChecking,
    clearRevealed,
    checkAndReveal, // Manual trigger
  };
}
