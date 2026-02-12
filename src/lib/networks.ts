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
      clawdiceVault: "0x42Ba5FC8870860fcE4C81931FD282118616cE480",
      clawdice: "0x3971dFAEa81B4C57c195Ae36510ec110375c0F71",
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
