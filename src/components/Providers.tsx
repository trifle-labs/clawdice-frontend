"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { config, projectId, metadata } from "@/lib/wagmi";
import { useState, useEffect } from "react";
import { PriceProvider } from "@/contexts/PriceContext";
import { NotificationProvider } from "@/components/Notifications";
import { baseSepolia } from "wagmi/chains";

// Initialize Web3Modal
if (projectId) {
  createWeb3Modal({
    wagmiConfig: config,
    projectId,
    metadata,
    defaultChain: baseSepolia,
    enableAnalytics: false,
    // Social login features
    featuredWalletIds: [
      "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
      "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0", // Trust
      "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa", // Coinbase
    ],
    // Enable social logins and email
    enableOnramp: true,
    // Theme
    themeMode: "light",
    themeVariables: {
      "--w3m-font-family": "Nunito, system-ui, sans-serif",
      "--w3m-accent": "#ec4899",
      "--w3m-border-radius-master": "2px",
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <PriceProvider>
          <NotificationProvider>
            {mounted ? children : null}
          </NotificationProvider>
        </PriceProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
