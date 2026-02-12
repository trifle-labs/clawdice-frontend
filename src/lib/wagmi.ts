import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";

export const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    appName: "Clawdice",
    appDescription: "Provably fair on-chain dice game",
    appUrl: "https://clawdice.xyz",
    appIcon: "https://clawdice.xyz/logo.jpg",
    enableFamily: false,
  })
);
