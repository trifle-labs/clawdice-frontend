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
      clawToken: "0xe0fF57065914962a70D37bfb6d980976822e4B73",
      clawdiceVault: "0x705FA1820DA34B41f36c3b0459112Ed7adFa8ed2",
      clawdice: "0xd64135C2AeFA49f75421D07d5bb15e8A5DADfC35",
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
