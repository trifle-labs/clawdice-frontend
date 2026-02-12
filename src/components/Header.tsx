"use client";

import Link from "next/link";
import Image from "next/image";
import { ConnectKitButton } from "connectkit";
import { Bot } from "lucide-react";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { useState } from "react";
import { DEFAULT_NETWORK } from "@/lib/networks";

export function Header() {
  const [currentNetwork, setCurrentNetwork] = useState(DEFAULT_NETWORK);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Clawdice"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="text-xl font-display text-shimmer">
              Clawdice
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/agents"
              className="text-accent-dark hover:text-accent transition-colors flex items-center gap-1 font-semibold"
            >
              <Bot className="w-4 h-4" />
              For Agents
            </Link>
            <Link
              href="/stats"
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Stats
            </Link>
            <Link
              href="/app/stake"
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Stake
            </Link>
            <Link
              href="/app/play"
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Play
            </Link>
            <a
              href="https://github.com/trifle-labs/clawdice"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <NetworkSwitcher
              currentNetwork={currentNetwork}
              onNetworkChange={setCurrentNetwork}
            />
            <ConnectKitButton />
          </div>
        </div>
      </div>
    </header>
  );
}
