"use client";

import { useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";

// Uniswap V4 StateView on Base Sepolia
const STATE_VIEW_ADDRESS = "0x571291b572ed32ce6751a2cb2486ebee8defb9b4";

// Pool ID for WETH/CLAW pool (fee=3000, tickSpacing=60)
// Calculated from: keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
const POOL_ID = "0x58d9ce02a92ff605d99e7bd58176ff673bf2783b78fbef2f0282591b635f0d62";

// StateView ABI (just the function we need)
const STATE_VIEW_ABI = [
  {
    name: "getSlot0",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
] as const;

/**
 * Hook to get the current CLAW/ETH pool price
 * Returns the amount of CLAW per 1 ETH
 */
export function usePoolPrice() {
  const { data, isLoading, error } = useReadContract({
    address: STATE_VIEW_ADDRESS,
    abi: STATE_VIEW_ABI,
    functionName: "getSlot0",
    args: [POOL_ID as `0x${string}`],
    chainId: baseSepolia.id,
    query: {
      refetchInterval: 30000, // Refresh every 30s
      staleTime: 15000,
    },
  });

  // Calculate price from sqrtPriceX96
  // For WETH/CLAW pool where WETH is token0:
  // price = (sqrtPriceX96 / 2^96)^2 = CLAW per WETH
  let clawPerEth = 10000; // Default fallback
  
  if (data) {
    const sqrtPriceX96 = data[0];
    // price = (sqrtPriceX96 / 2^96)^2
    // To avoid overflow, we do: (sqrtPriceX96^2) / 2^192
    const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
    clawPerEth = sqrtPrice * sqrtPrice;
  }

  return {
    clawPerEth,
    tick: data?.[1],
    isLoading,
    error,
  };
}
