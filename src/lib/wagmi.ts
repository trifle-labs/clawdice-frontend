import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

// Config without WalletConnect (avoids hanging on mobile without project ID)
export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "Clawdice",
      appLogoUrl: "https://clawdice.xyz/logo.jpg",
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});
