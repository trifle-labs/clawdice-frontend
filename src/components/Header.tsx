"use client";

import Link from "next/link";
import Image from "next/image";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useState } from "react";
import { Menu, X, Coins } from "lucide-react";
import { useChainId, useAccount } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { formatEther } from "viem";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { DEFAULT_NETWORK } from "@/lib/networks";
import { SwapModal } from "./SwapModal";
import { CurrencyToggle } from "@/contexts/PriceContext";
import { useIndexedClawBalance } from "@/hooks/useIndexedBalances";

export function Header() {
  const [currentNetwork, setCurrentNetwork] = useState(DEFAULT_NETWORK);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  
  // Fetch CLAW balance via Index Supply
  const { data: clawBalance } = useIndexedClawBalance();
  
  // Format balance for display
  const formatBalance = (balance: bigint | undefined) => {
    if (!balance) return "0";
    const num = Number(formatEther(balance));
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    if (num >= 1) return num.toFixed(1);
    return num.toFixed(4);
  };
  
  // Show in-app swap on testnet, Uniswap link on mainnet
  const isTestnet = chainId === baseSepolia.id;

  return (
  <>
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-primary/20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Clawdice"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="text-lg font-display text-shimmer hidden sm:inline">
              Clawdice
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <NavLink href="/agents">Agents</NavLink>
            <NavLink href="/stats">Stats</NavLink>
            <NavLink href="/app/stake">Stake</NavLink>
            <NavLink href="/app/play">Play</NavLink>
            {isTestnet ? (
              <button
                onClick={() => setSwapOpen(true)}
                className="text-accent-dark hover:text-accent transition-colors font-medium"
              >
                Get CLAW
              </button>
            ) : (
              <a
                href="https://app.uniswap.org/swap?outputCurrency=0xD2C1CB4556ca49Ac6C7A5bc71657bD615500057c&chain=base"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-dark hover:text-accent transition-colors font-medium"
              >
                Get CLAW ↗
              </a>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <CurrencyToggle />
            <NetworkSwitcher
              currentNetwork={currentNetwork}
              onNetworkChange={setCurrentNetwork}
            />
            {/* CLAW Balance */}
            {isConnected && clawBalance !== undefined && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 glass rounded-full text-sm font-medium">
                <Coins className="w-4 h-4 text-primary" />
                <span>{formatBalance(clawBalance)}</span>
                <span className="text-foreground/50">CLAW</span>
              </div>
            )}
            <div className="hidden sm:block">
              <button
                onClick={() => open()}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-full text-sm font-medium transition-colors"
              >
                {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : "Connect"}
              </button>
            </div>
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-foreground/70"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden glass border-t border-primary/20 px-4 py-4">
          <nav className="flex flex-col gap-3 text-sm">
            <NavLink href="/agents" onClick={() => setMenuOpen(false)}>Agents</NavLink>
            <NavLink href="/stats" onClick={() => setMenuOpen(false)}>Stats</NavLink>
            <NavLink href="/app/stake" onClick={() => setMenuOpen(false)}>Stake</NavLink>
            <NavLink href="/app/play" onClick={() => setMenuOpen(false)}>Play</NavLink>
            {isTestnet ? (
              <button
                onClick={() => { setSwapOpen(true); setMenuOpen(false); }}
                className="text-accent-dark hover:text-accent transition-colors font-medium text-left"
              >
                Get CLAW
              </button>
            ) : (
              <a
                href="https://app.uniswap.org/swap?outputCurrency=0xD2C1CB4556ca49Ac6C7A5bc71657bD615500057c&chain=base"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-dark hover:text-accent transition-colors font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Get CLAW ↗
              </a>
            )}
          </nav>
          {/* Mobile CLAW Balance */}
          {isConnected && clawBalance !== undefined && (
            <div className="flex items-center gap-1.5 px-3 py-2 glass rounded-full text-sm font-medium w-fit mb-3">
              <Coins className="w-4 h-4 text-primary" />
              <span>{formatBalance(clawBalance)}</span>
              <span className="text-foreground/50">CLAW</span>
            </div>
          )}
          <div>
            <button
              onClick={() => { open(); setMenuOpen(false); }}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-full text-sm font-medium transition-colors w-full"
            >
              {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : "Connect Wallet"}
            </button>
          </div>
        </div>
      )}

    </header>

    {/* Swap Modal - rendered outside header to avoid z-index stacking context issues */}
    <SwapModal isOpen={swapOpen} onClose={() => setSwapOpen(false)} />
  </>
  );
}

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-foreground/70 hover:text-foreground transition-colors font-medium"
    >
      {children}
    </Link>
  );
}
