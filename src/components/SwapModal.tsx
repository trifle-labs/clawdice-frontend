"use client";

import { useState } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseEther, formatEther } from "viem";
import { baseSepolia, base } from "wagmi/chains";
import { CONTRACTS, CLAWDICE_ABI } from "@/lib/contracts";
import { ExternalLink } from "lucide-react";

// CLAW token address
const CLAW_TOKEN = "0xD2C1CB4556ca49Ac6C7A5bc71657bD615500057c";

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SwapModal({ isOpen, onClose }: SwapModalProps) {
  const chainId = useChainId();
  const isTestnet = chainId === baseSepolia.id;
  const isMainnet = chainId === base.id;

  const [ethAmount, setEthAmount] = useState("");
  const { address, isConnected } = useAccount();
  
  const { data: ethBalance } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Rough estimate: 1 ETH ≈ 1 CLAW (adjust based on actual pool ratio)
  const estimatedClaw = ethAmount ? parseFloat(ethAmount) : 0;

  const handleSwap = () => {
    if (!ethAmount || parseFloat(ethAmount) <= 0) return;
    
    writeContract({
      address: CONTRACTS.baseSepolia.clawdice,
      abi: CLAWDICE_ABI,
      functionName: "swapETHForClaw",
      args: [BigInt(0)], // minTokensOut - 0 for testnet simplicity
      value: parseEther(ethAmount),
    });
  };

  const handleMaxClick = () => {
    if (ethBalance) {
      // Leave some ETH for gas
      const max = parseFloat(formatEther(ethBalance.value)) - 0.001;
      setEthAmount(max > 0 ? max.toFixed(6) : "0");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Get CLAW</h2>
          <button 
            onClick={onClose}
            className="text-gray-900/60 hover:text-gray-900 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Mainnet: Link to Uniswap */}
        {isMainnet && (
          <div className="text-center py-6">
            <p className="text-gray-900/60 mb-4">Swap ETH for CLAW on Uniswap</p>
            <a
              href={`https://app.uniswap.org/swap?outputCurrency=${CLAW_TOKEN}&chain=base`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF007A] text-white rounded-xl font-bold hover:bg-[#FF007A]/90 transition-colors"
            >
              Open Uniswap
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Testnet: Custom Swap UI */}
        {isTestnet && (
          <>
            {isSuccess ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🎰</div>
                <p className="text-lg font-medium text-green-500">Swap Successful!</p>
                <p className="text-sm text-gray-900/60 mt-2">CLAW tokens added to your wallet</p>
                <button
                  onClick={onClose}
                  className="mt-6 w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* ETH Input */}
                <div className="bg-gray-50 rounded-xl p-4 mb-2">
                  <div className="flex justify-between text-sm text-gray-900/60 mb-2">
                    <span>You pay</span>
                    <span>
                      Balance: {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : "0"} ETH
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={ethAmount}
                      onChange={(e) => setEthAmount(e.target.value)}
                      placeholder="0.0"
                      className="flex-1 bg-transparent text-2xl font-medium outline-none"
                      step="0.001"
                      min="0"
                    />
                    <button
                      onClick={handleMaxClick}
                      className="text-xs bg-primary/20 text-primary px-2 py-1 rounded"
                    >
                      MAX
                    </button>
                    <span className="text-lg font-medium">ETH</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center -my-1 relative z-10">
                  <div className="bg-white border border-gray-200 rounded-lg p-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>

                {/* CLAW Output */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="flex justify-between text-sm text-gray-900/60 mb-2">
                    <span>You receive (estimated)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-2xl font-medium">
                      {estimatedClaw > 0 ? `~${estimatedClaw.toFixed(4)}` : "0.0"}
                    </span>
                    <span className="text-lg font-medium">CLAW</span>
                  </div>
                </div>

                {/* Info */}
                <div className="text-xs text-gray-900/50 mb-4 p-3 bg-gray-50 rounded-lg">
                  <p>⚡ Swaps via Uniswap V4 pool</p>
                  <p className="mt-1">💡 Testnet only - rates may vary</p>
                </div>

                {/* Error */}
                {error && (
                  <div className="text-red-500 text-sm mb-4 p-3 bg-red-500/10 rounded-lg">
                    {error.message.includes("user rejected") 
                      ? "Transaction cancelled" 
                      : "Swap failed - check pool liquidity"}
                  </div>
                )}

                {/* Swap Button */}
                <button
                  onClick={handleSwap}
                  disabled={!isConnected || !ethAmount || parseFloat(ethAmount) <= 0 || isPending || isConfirming}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  {!isConnected 
                    ? "Connect Wallet" 
                    : isPending 
                      ? "Confirm in Wallet..." 
                      : isConfirming 
                        ? "Swapping..." 
                        : "Swap for CLAW"}
                </button>
              </>
            )}
          </>
        )}

        {/* Unsupported network */}
        {!isMainnet && !isTestnet && (
          <div className="text-center py-8">
            <p className="text-gray-900/60">Please switch to Base or Base Sepolia</p>
          </div>
        )}
      </div>
    </div>
  );
}
