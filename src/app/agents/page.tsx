import { Bot, Terminal, Zap, Shield, Code, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getActiveNetwork } from "@/lib/networks";

const SKILL_INSTALL_COMMAND = `curl -sSL https://raw.githubusercontent.com/trifle-labs/clawdice/main/skills/clawdice/install.sh | bash`;

const SKILL_CONTENT = `# Clawdice Skill

Play provably fair dice on Base blockchain.

## Commands
- \`/clawdice bet <amount> <odds>\` - Place a bet
- \`/clawdice claim <betId>\` - Claim winnings
- \`/clawdice stake <amount>\` - Stake to vault
- \`/clawdice unstake <shares>\` - Unstake from vault
- \`/clawdice status\` - Check pending bets
- \`/clawdice balance\` - Check balances

## Strategies
- \`/clawdice martingale <rounds>\` - Run martingale strategy
- \`/clawdice dalembert <rounds>\` - Run d'Alembert strategy
- \`/clawdice fibonacci <rounds>\` - Run Fibonacci strategy`;

export default function AgentsPage() {
  const network = getActiveNetwork();
  const { clawdice, clawdiceVault, clawToken } = network.contracts;

  return (
    <div className="min-h-screen gradient-dark py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero for Agents */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent mb-6">
            <Bot className="w-5 h-5" />
            <span className="font-medium">Built for AI Agents</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Install Clawdice Skill
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Add on-chain dice betting to your AI agent. Provably fair, instant payouts,
            automated strategies.
          </p>
        </div>

        {/* Quick Install */}
        <div className="glass rounded-2xl p-6 md:p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Quick Install
          </h2>

          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
            <code className="text-green-400">{SKILL_INSTALL_COMMAND}</code>
          </div>

          <p className="text-gray-400 text-sm">
            Or manually add to your skills directory:
          </p>

          <div className="mt-4 bg-black/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300 whitespace-pre-wrap">{SKILL_CONTENT}</pre>
          </div>
        </div>

        {/* Features for Agents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="glass rounded-xl p-6">
            <Zap className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Automated Strategies</h3>
            <p className="text-gray-400">
              Built-in Martingale, D&apos;Alembert, Fibonacci, and Oscar&apos;s Grind strategies.
              Run them with a single command.
            </p>
          </div>

          <div className="glass rounded-xl p-6">
            <Shield className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Kelly Criterion Limits</h3>
            <p className="text-gray-400">
              Max bet automatically calculated to prevent house ruin. Safe for
              autonomous operation.
            </p>
          </div>

          <div className="glass rounded-xl p-6">
            <Code className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">TypeScript SDK</h3>
            <p className="text-gray-400">
              Full SDK for custom integrations. Place bets, claim winnings, stake
              the vault programmatically.
            </p>
          </div>

          <div className="glass rounded-xl p-6">
            <Terminal className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">CLI Interface</h3>
            <p className="text-gray-400">
              Command-line tool for scripting and automation. Perfect for agent
              workflows.
            </p>
          </div>
        </div>

        {/* SDK Install */}
        <div className="glass rounded-2xl p-6 md:p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4">SDK Installation</h2>

          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm mb-4">
            <code className="text-green-400">npm install @trifle-labs/clawdice</code>
          </div>

          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">{`import { Clawdice } from '@trifle-labs/clawdice';

const clawdice = new Clawdice({
  chain: baseSepolia,
  account: yourAccount, // from wallet or env
});

// Place a bet at 50% odds
const { betId } = await clawdice.placeBet({
  amount: parseEther('100'),
  odds: 0.5
});

// Wait for next block, then claim
const result = await clawdice.computeResult(betId);
if (result.won) {
  await clawdice.claim(betId);
}`}</pre>
          </div>
        </div>

        {/* Contract Addresses */}
        <div className="glass rounded-2xl p-6 md:p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4">Contract Addresses (Base Sepolia)</h2>

          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <span className="text-gray-400">Clawdice</span>
              <code className="text-primary">{clawdice}</code>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <span className="text-gray-400">Vault</span>
              <code className="text-primary">{clawdiceVault}</code>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <span className="text-gray-400">CLAW Token</span>
              <code className="text-primary">{clawToken}</code>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href="https://github.com/trifle-labs/clawdice"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="https://github.com/trifle-labs/clawdice/tree/main/skills/clawdice"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            <Bot className="w-4 h-4" />
            Skill Docs
          </a>
          <Link
            href="/stats"
            className="flex items-center gap-2 px-6 py-3 gradient-primary rounded-lg hover:opacity-90 transition-opacity"
          >
            Watch Live Games
          </Link>
        </div>
      </div>
    </div>
  );
}
