import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";

// WalletConnect Project ID from env (set in Netlify)
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

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
    ssr: true,
  })
);
