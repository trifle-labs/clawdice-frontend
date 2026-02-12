import { baseSepolia, base } from "wagmi/chains";
import { Address } from "viem";
import { CONTRACTS } from "./contracts";

export interface NetworkConfig {
  chain: typeof base | typeof baseSepolia;
  name: string;
  isLive: boolean;
  contracts: {
    clawToken: Address;
    clawdiceVault: Address;
    clawdice: Address;
  };
  indexerChainId: number;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  baseSepolia: {
    chain: baseSepolia,
    name: "Base Sepolia",
    isLive: true,
    contracts: CONTRACTS.baseSepolia,
    indexerChainId: 84532,
  },
  base: {
    chain: base,
    name: "Base",
    isLive: false, // Not deployed yet
    contracts: {
      clawToken: "0x0000000000000000000000000000000000000000" as Address,
      clawdiceVault: "0x0000000000000000000000000000000000000000" as Address,
      clawdice: "0x0000000000000000000000000000000000000000" as Address,
    },
    indexerChainId: 8453,
  },
};

export const DEFAULT_NETWORK = "baseSepolia";

export function getActiveNetwork(): NetworkConfig {
  // Return the first live network, defaulting to sepolia
  const liveNetworks = Object.values(NETWORKS).filter((n) => n.isLive);
  return liveNetworks[0] || NETWORKS[DEFAULT_NETWORK];
}

export function isMainnetLive(): boolean {
  return NETWORKS.base.isLive;
}
