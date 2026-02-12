"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PriceContextType {
  clawPrice: number; // USD per CLAW
  showUsd: boolean;
  toggleCurrency: () => void;
  formatValue: (clawAmount: number | bigint, options?: { decimals?: number }) => string;
}

const PriceContext = createContext<PriceContextType | null>(null);

// Testnet: use hardcoded price (1 CLAW ≈ 0.001 USD for demo)
// Mainnet: would fetch from CoinGecko or DEX
const TESTNET_PRICE = 0.001;

export function PriceProvider({ children }: { children: ReactNode }) {
  const [showUsd, setShowUsd] = useState(false);
  // TODO: fetch price from CoinGecko/DEX on mainnet
  const clawPrice = TESTNET_PRICE;

  // Load preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("showUsd");
    if (saved) setShowUsd(saved === "true");
  }, []);

  const toggleCurrency = () => {
    setShowUsd((prev) => {
      const next = !prev;
      localStorage.setItem("showUsd", String(next));
      return next;
    });
  };

  const formatValue = (
    clawAmount: number | bigint,
    options: { decimals?: number } = {}
  ): string => {
    const { decimals = 2 } = options;
    const amount = typeof clawAmount === "bigint" 
      ? Number(clawAmount) / 1e18 
      : clawAmount;

    if (showUsd) {
      const usdValue = amount * clawPrice;
      if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(1)}M`;
      if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
      if (usdValue >= 1) return `$${usdValue.toFixed(decimals)}`;
      return `$${usdValue.toFixed(4)}`;
    } else {
      if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M CLAW`;
      if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K CLAW`;
      return `${amount.toFixed(decimals)} CLAW`;
    }
  };

  return (
    <PriceContext.Provider value={{ clawPrice, showUsd, toggleCurrency, formatValue }}>
      {children}
    </PriceContext.Provider>
  );
}

export function usePrice() {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error("usePrice must be used within PriceProvider");
  return ctx;
}

// Small toggle component
export function CurrencyToggle() {
  const { showUsd, toggleCurrency } = usePrice();
  
  return (
    <button
      onClick={toggleCurrency}
      className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-background/50 hover:bg-background border border-border transition-colors"
      title="Toggle CLAW/USD"
    >
      <span className={showUsd ? "text-foreground/50" : "text-primary font-bold"}>
        CLAW
      </span>
      <span className="text-foreground/30">/</span>
      <span className={showUsd ? "text-green-500 font-bold" : "text-foreground/50"}>
        USD
      </span>
    </button>
  );
}
