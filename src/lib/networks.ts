import { baseSepolia, base } from "wagmi/chains";
import { Address } from "viem";

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
    contracts: {
      clawToken: "0xD2C1CB4556ca49Ac6C7A5bc71657bD615500057c",
      clawdiceVault: "0xA186fa18f9889097F7F7746378932b50f5A91E61",
      clawdice: "0x8eE2FCe0b8Bd17D4C958163dd2ef6877BA9eED7B",
    },
    indexerChainId: 84532,
  },
  base: {
    chain: base,
    name: "Base",
    isLive: false, // Not deployed yet
    contracts: {
      clawToken: "0x0000000000000000000000000000000000000000",
      clawdiceVault: "0x0000000000000000000000000000000000000000",
      clawdice: "0x0000000000000000000000000000000000000000",
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
