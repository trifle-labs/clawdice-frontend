"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, TrendingUp, Vault, Bot, Eye, Dice5, Code, Zap, Users, BarChart3, Cpu, Wallet } from "lucide-react";
import { LiveTicker } from "@/components/LiveTicker";
import { HomeStats } from "@/components/HomeStats";
import clsx from "clsx";

type Mode = "agent" | "human";

export default function Home() {
  const [mode, setMode] = useState<Mode>("agent");

  return (
    <div className="bg-kawaii min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden px-4 pt-20">
        {/* Subtle background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
          <div className={clsx(
            "absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl transition-colors duration-500",
            mode === "agent" 
              ? "bg-gradient-to-br from-accent/30 to-primary/20" 
              : "bg-gradient-to-br from-mint/30 to-primary/20"
          )} />
          <div className={clsx(
            "absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl transition-colors duration-500",
            mode === "agent"
              ? "bg-gradient-to-tr from-primary/30 to-accent/20"
              : "bg-gradient-to-tr from-primary/30 to-mint/20"
          )} />
        </div>

        <div className="relative z-10 text-center max-w-lg mx-auto">
          {/* Mode Toggle */}
          <div className="flex justify-center mb-6">
            <div className="glass rounded-full p-1 flex gap-1">
              <button
                onClick={() => setMode("agent")}
                className={clsx(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  mode === "agent"
                    ? "bg-accent text-white shadow-md"
                    : "text-foreground/60 hover:text-foreground"
                )}
              >
                <Bot className="w-4 h-4" />
                Agent
              </button>
              <button
                onClick={() => setMode("human")}
                className={clsx(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  mode === "human"
                    ? "bg-mint text-white shadow-md"
                    : "text-foreground/60 hover:text-foreground"
                )}
              >
                <Users className="w-4 h-4" />
                Human
              </button>
            </div>
          </div>

          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="Clawdice"
              width={140}
              height={140}
              className="drop-shadow-xl rounded-full"
              priority
            />
          </div>

          {mode === "agent" ? (
            <>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display mb-3">
                <span className="text-shimmer">Autonomous</span>
                <br />
                <span className="text-foreground">On-Chain Gaming</span>
              </h1>
              <p className="text-foreground/60 mb-8 text-sm sm:text-base">
                The first dice protocol built for AI agents. SDK, CLI, gasless sessions.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display mb-3">
                <span className="text-shimmer">Stake the House</span>
                <br />
                <span className="text-foreground">Earn from Agent Bets</span>
              </h1>
              <p className="text-foreground/60 mb-8 text-sm sm:text-base">
                Deposit CLAW, earn 1% edge on every agent bet. Watch the games live.
              </p>
            </>
          )}

          {mode === "agent" ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              <Link
                href="/agents"
                className="btn-accent rounded-full px-6 py-3 font-bold flex items-center justify-center gap-2"
              >
                <Code className="w-4 h-4" />
                View SDK
              </Link>
              <Link
                href="/app/play"
                className="btn-kawaii flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Try It
              </Link>
              <Link
                href="/stats"
                className="glass hover:bg-white/80 text-foreground font-semibold px-6 py-3 rounded-full flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Stats
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              <Link
                href="/app/stake"
                className="btn-mint rounded-full px-6 py-3 font-bold flex items-center justify-center gap-2"
              >
                <Vault className="w-4 h-4" />
                Stake Now
              </Link>
              <Link
                href="/app/play"
                className="btn-kawaii flex items-center justify-center gap-2"
              >
                <Dice5 className="w-4 h-4" />
                Play
              </Link>
              <Link
                href="/stats"
                className="glass hover:bg-white/80 text-foreground font-semibold px-6 py-3 rounded-full flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Watch
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Live Ticker */}
      <LiveTicker />

      {/* Stats */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <HomeStats />
        </div>
      </section>

      {/* Features - different for each mode */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {mode === "agent" ? (
            <>
              <h2 className="text-xl font-display text-center mb-6 text-foreground">
                Built for Autonomous Agents
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <FeatureCard
                  icon={<Cpu className="w-5 h-5" />}
                  title="Session Keys"
                  desc="Sign once, bet without popups for 24h"
                />
                <FeatureCard
                  icon={<Zap className="w-5 h-5" />}
                  title="Gasless Reveals"
                  desc="Sponsored transactions via Paymaster"
                />
                <FeatureCard
                  icon={<Code className="w-5 h-5" />}
                  title="TypeScript SDK"
                  desc="npm install clawdice-sdk"
                />
                <FeatureCard
                  icon={<Shield className="w-5 h-5" />}
                  title="Provably Fair"
                  desc="Blockhash RNG, verifiable on-chain"
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-display text-center mb-6 text-foreground">
                Be the House, Not the Player
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <FeatureCard
                  icon={<Vault className="w-5 h-5" />}
                  title="ERC-4626 Vault"
                  desc="Deposit CLAW, get yield-bearing shares"
                />
                <FeatureCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  title="1% House Edge"
                  desc="Kelly-optimized, sustainable returns"
                />
                <FeatureCard
                  icon={<Eye className="w-5 h-5" />}
                  title="Watch Live"
                  desc="See every bet and result in real-time"
                />
                <FeatureCard
                  icon={<Wallet className="w-5 h-5" />}
                  title="Withdraw Anytime"
                  desc="No lockups, instant redemption"
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Mode-specific CTA */}
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto text-center">
          {mode === "agent" ? (
            <div className="card-kawaii p-6">
              <Bot className="w-10 h-10 text-accent mx-auto mb-3" />
              <h3 className="font-display text-lg mb-2">Ready to Integrate?</h3>
              <p className="text-sm text-foreground/60 mb-4">
                Check out the docs, grab the SDK, and start betting autonomously.
              </p>
              <Link
                href="/agents"
                className="btn-accent rounded-full px-6 py-2 text-sm font-bold inline-flex items-center gap-2"
              >
                <Code className="w-4 h-4" />
                Read the Docs
              </Link>
            </div>
          ) : (
            <div className="card-kawaii p-6">
              <Vault className="w-10 h-10 text-mint mx-auto mb-3" />
              <h3 className="font-display text-lg mb-2">Start Earning Today</h3>
              <p className="text-sm text-foreground/60 mb-4">
                Deposit CLAW to the vault and earn your share of agent betting fees.
              </p>
              <Link
                href="/app/stake"
                className="btn-mint rounded-full px-6 py-2 text-sm font-bold inline-flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Stake CLAW
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Jurisdiction footer note */}
      <section className="pb-8 px-4">
        <p className="text-center text-xs text-foreground/40 max-w-md mx-auto">
          Play available in non-restricted jurisdictions only. Staking and watching available globally.
        </p>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card-kawaii p-4">
      <div className="text-primary mb-2">{icon}</div>
      <h3 className="font-bold text-sm text-foreground">{title}</h3>
      <p className="text-xs text-foreground/60">{desc}</p>
    </div>
  );
}
