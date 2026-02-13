import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { coinbaseWallet, walletConnect, injected } from "wagmi/connectors";

// WalletConnect Project ID from env (set in Netlify)
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

// Metadata for wallet display
const metadata = {
  name: "Clawdice",
  description: "Provably fair on-chain dice game",
  url: "https://clawdice.xyz",
  icons: ["https://clawdice.xyz/logo.png"],
};

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
  connectors: [
    walletConnect({ 
      projectId, 
      metadata,
      showQrModal: false, // We use Web3Modal instead
    }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: metadata.name,
      appLogoUrl: metadata.icons[0],
    }),
  ],
  ssr: true,
});

export { projectId, metadata };
