import Link from "next/link";
import {
  Dice5,
  Shield,
  TrendingUp,
  Vault,
  Zap,
  BarChart3,
  Users,
  Coins,
} from "lucide-react";
import { LiveTicker } from "@/components/LiveTicker";
import { StatCard } from "@/components/StatCard";

const features = [
  {
    icon: <Shield className="w-8 h-8" />,
    title: "Provably Fair",
    description:
      "Every result derived from blockhash. Verify any roll on-chain.",
  },
  {
    icon: <TrendingUp className="w-8 h-8" />,
    title: "Kelly Criterion",
    description:
      "Mathematically optimal bet limits protect the house from ruin.",
  },
  {
    icon: <Vault className="w-8 h-8" />,
    title: "ERC-4626 Vault",
    description: "Stake tokens, earn yield from the 1% house edge.",
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: "Instant Payouts",
    description: "Win and withdraw in seconds. No delays, no middlemen.",
  },
];

export default function Home() {
  return (
    <div className="gradient-dark">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <Dice5 className="w-24 h-24 text-primary animate-pulse-slow" />
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary via-primary-light to-accent bg-clip-text text-transparent">
              Provably Fair
            </span>
            <br />
            On-Chain Dice
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-10">
            Stake the house or test your luck. Every roll verified on Base.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/app/stake"
              className="gradient-primary hover:opacity-90 text-white font-semibold px-8 py-4 rounded-xl transition-all glow-primary"
            >
              Stake Now
            </Link>
            <Link
              href="/app/play"
              className="glass hover:bg-primary/20 text-white font-semibold px-8 py-4 rounded-xl transition-all"
            >
              Play Now
            </Link>
          </div>
        </div>
      </section>

      {/* Live Ticker */}
      <LiveTicker />

      {/* Stats Preview */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <StatCard
              label="Total Volume"
              value="1.2M CLAW"
              icon={<Coins className="w-8 h-8" />}
            />
            <StatCard
              label="Total Bets"
              value="45,678"
              icon={<Dice5 className="w-8 h-8" />}
            />
            <StatCard
              label="Unique Players"
              value="1,234"
              icon={<Users className="w-8 h-8" />}
            />
            <StatCard
              label="Vault TVL"
              value="500K CLAW"
              subValue="8.5% APY"
              trend="up"
              icon={<BarChart3 className="w-8 h-8" />}
            />
          </div>

          <div className="text-center mt-8">
            <Link
              href="/stats"
              className="text-primary hover:text-primary-light transition-colors"
            >
              View All Stats →
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Clawdice?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass rounded-xl p-6 hover:glow-primary transition-all group"
              >
                <div className="text-primary group-hover:text-primary-light transition-colors mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 border-t border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Choose Your Odds</h3>
              <p className="text-gray-400">
                Select win probability from 1-99%. Higher odds = lower payout.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Place Your Bet</h3>
              <p className="text-gray-400">
                Bet commits to current block. Result determined by next blockhash.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Claim Winnings</h3>
              <p className="text-gray-400">
                Win? Claim your payout instantly. Lose? Try again or stake the house.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass rounded-2xl p-8 md:p-12 text-center glow-primary">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Roll?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Connect your wallet and start playing. Or stake the house and earn
              passive yield from every bet placed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/app/stake"
                className="gradient-accent hover:opacity-90 text-black font-semibold px-8 py-4 rounded-xl transition-all"
              >
                Stake the House
              </Link>
              <Link
                href="/app/play"
                className="gradient-primary hover:opacity-90 text-white font-semibold px-8 py-4 rounded-xl transition-all"
              >
                Start Playing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
