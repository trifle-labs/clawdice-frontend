"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { Vault, Info } from "lucide-react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { CONTRACTS, VAULT_ABI, ERC20_ABI } from "@/lib/contracts";

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const { open: openWalletModal } = useWeb3Modal();
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");

  // Read vault data
  const { data: totalAssets } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "totalAssets",
  });

  const { data: totalSupply } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "totalSupply",
  });

  const { data: userShares } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: userShareValue } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: userShares ? [userShares] : undefined,
  });

  const { data: userTokenBalance } = useReadContract({
    address: CONTRACTS.baseSepolia.clawToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: previewShares } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "previewDeposit",
    args: amount ? [parseEther(amount)] : undefined,
  });

  const { data: previewAssets } = useReadContract({
    address: CONTRACTS.baseSepolia.clawdiceVault,
    abi: VAULT_ABI,
    functionName: "previewRedeem",
    args: amount ? [parseEther(amount)] : undefined,
  });

  // Write functions
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const sharePrice = totalAssets && totalSupply && totalSupply > 0n
    ? Number(formatEther(totalAssets)) / Number(formatEther(totalSupply))
    : 1;

  const userSharePercent = userShares && totalSupply && totalSupply > 0n
    ? (Number(formatEther(userShares)) / Number(formatEther(totalSupply)) * 100).toFixed(2)
    : "0";

  const handleStake = async () => {
    if (!address || !amount) return;

    // First approve
    writeContract({
      address: CONTRACTS.baseSepolia.clawToken,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.baseSepolia.clawdiceVault, parseEther(amount)],
    });
  };

  const handleUnstake = async () => {
    if (!address || !amount) return;

    writeContract({
      address: CONTRACTS.baseSepolia.clawdiceVault,
      abi: VAULT_ABI,
      functionName: "redeem",
      args: [parseEther(amount), address, address],
    });
  };

  const handleMax = () => {
    if (activeTab === "stake" && userTokenBalance) {
      setAmount(formatEther(userTokenBalance));
    } else if (activeTab === "unstake" && userShares) {
      setAmount(formatEther(userShares));
    }
  };

  return (
    <div className="min-h-screen gradient-dark py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Stake</h1>
        <p className="text-gray-400 mb-8">
          Deposit CLAW tokens and earn yield from the 1% house edge.
        </p>

        {/* Vault Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-1">Total Staked</p>
            <p className="text-xl font-bold">
              {totalAssets ? `${Number(formatEther(totalAssets)).toLocaleString()} CLAW` : "..."}
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-1">Share Price</p>
            <p className="text-xl font-bold">{sharePrice.toFixed(4)} CLAW</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-1">Your Shares</p>
            <p className="text-xl font-bold">
              {userShares ? Number(formatEther(userShares)).toLocaleString() : "0"}
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-1">Your Value</p>
            <p className="text-xl font-bold text-accent">
              {userShareValue ? `${Number(formatEther(userShareValue)).toLocaleString()} CLAW` : "0 CLAW"}
            </p>
          </div>
        </div>

        {/* Your Position */}
        {isConnected && userShares && userShares > 0n && (
          <div className="glass rounded-xl p-6 mb-8">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Vault className="w-5 h-5 text-primary" />
              Your Position
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Shares</p>
                <p className="font-mono">{Number(formatEther(userShares)).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Pool Share</p>
                <p className="text-primary">{userSharePercent}%</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Value</p>
                <p className="text-accent font-bold">
                  {userShareValue ? Number(formatEther(userShareValue)).toLocaleString() : "0"} CLAW
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stake/Unstake Card */}
        <div className="glass rounded-xl p-6">
          {!isConnected ? (
            <div className="text-center py-8">
              <Vault className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
              <p className="text-gray-400 mb-4">Connect your wallet to stake</p>
              <button
                onClick={() => openWalletModal()}
                className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-full font-bold transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                {(["stake", "unstake"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setAmount("");
                    }}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                      activeTab === tab
                        ? "gradient-primary text-white"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">
                  {activeTab === "stake" ? "Amount to Stake" : "Shares to Unstake"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-black/30 border border-primary/30 rounded-lg px-4 py-3 text-xl font-mono focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleMax}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary-light text-sm font-medium"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Balance: {activeTab === "stake"
                    ? `${userTokenBalance ? Number(formatEther(userTokenBalance)).toLocaleString() : "0"} CLAW`
                    : `${userShares ? Number(formatEther(userShares)).toLocaleString() : "0"} shares`
                  }
                </p>
              </div>

              {/* Preview */}
              {amount && (
                <div className="bg-black/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-400">
                    {activeTab === "stake" ? "You will receive:" : "You will receive:"}
                  </p>
                  <p className="text-xl font-bold text-accent">
                    {activeTab === "stake"
                      ? `${previewShares ? Number(formatEther(previewShares)).toLocaleString() : "..."} shares`
                      : `${previewAssets ? Number(formatEther(previewAssets)).toLocaleString() : "..."} CLAW`
                    }
                  </p>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={activeTab === "stake" ? handleStake : handleUnstake}
                disabled={!amount || isPending || isConfirming}
                className="w-full gradient-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all"
              >
                {isPending || isConfirming
                  ? "Processing..."
                  : activeTab === "stake"
                  ? "Stake CLAW"
                  : "Unstake"
                }
              </button>

              {/* Info */}
              <div className="mt-6 p-4 bg-primary/10 rounded-lg flex gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="mb-1">
                    <strong>How staking works:</strong>
                  </p>
                  <p>
                    Your shares represent a proportional claim on the vault. As players bet and the
                    house wins from the 1% edge, the vault grows and your shares become worth more
                    CLAW tokens.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
