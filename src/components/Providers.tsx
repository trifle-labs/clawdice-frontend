"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { config } from "@/lib/wagmi";
import { useState, useEffect } from "react";
import { PriceProvider } from "@/contexts/PriceContext";

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
        <ConnectKitProvider
          theme="soft"
          mode="light"
          customTheme={{
            "--ck-font-family": "Nunito, system-ui, sans-serif",
            "--ck-accent-color": "#ec4899",
            "--ck-accent-text-color": "#ffffff",
            "--ck-border-radius": "16px",
          }}
          options={{
            initialChainId: 84532, // Base Sepolia
          }}
        >
          <PriceProvider>
            {mounted ? children : null}
          </PriceProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
