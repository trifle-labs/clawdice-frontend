import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";

// WalletConnect Project ID (from WalletConnect Cloud dashboard)
// Format: 32-char hex without dashes
const WALLETCONNECT_PROJECT_ID = "223fbf1b7d2144e7b34723899c9e76e6";

export const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
    walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
    appName: "Clawdice",
    appDescription: "Provably fair on-chain dice game",
    appUrl: "https://clawdice.xyz",
    appIcon: "https://clawdice.xyz/logo.jpg",
    // SSR safety
    ssr: true,
  })
);
