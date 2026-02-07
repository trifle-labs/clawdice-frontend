"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";
import { Dice5 } from "lucide-react";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Dice5 className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              Clawdice
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/stats"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Stats
            </Link>
            <Link
              href="/app/stake"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Stake
            </Link>
            <Link
              href="/app/play"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Play
            </Link>
            <a
              href="https://github.com/trifle-labs/clawdice"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </nav>

          <ConnectKitButton />
        </div>
      </div>
    </header>
  );
}
