import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";

export const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
    walletConnectProjectId: "223fbf1b-7d21-44e7-b347-23899c9e76e6",
    appName: "Clawdice",
    appDescription: "Provably fair on-chain dice game",
    appUrl: "https://clawdice.xyz",
    appIcon: "https://clawdice.xyz/logo.jpg",
  })
);
