import { Dice5, Github, Twitter } from "lucide-react";
import Link from "next/link";
import { getActiveNetwork } from "@/lib/networks";

export function Footer() {
  const network = getActiveNetwork();
  const { clawdice, clawdiceVault, clawToken } = network.contracts;
  const explorerBase = "https://sepolia.basescan.org/address";

  return (
    <footer className="border-t border-primary/20 bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Dice5 className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold">Clawdice</span>
            </Link>
            <p className="text-gray-400 max-w-md">
              Provably fair on-chain dice game on Base. Stake the house or test
              your luck. Every roll verified on-chain.
            </p>
            <div className="flex gap-4 mt-4">
              <a
                href="https://github.com/trifle-labs/clawdice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-primary transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com/trifle_labs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-primary transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/app/stake"
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  Stake
                </Link>
              </li>
              <li>
                <Link
                  href="/app/play"
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  Play
                </Link>
              </li>
              <li>
                <Link
                  href="/stats"
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  Stats
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contracts</h3>
            <ul className="space-y-2 text-sm font-mono">
              <li>
                <a
                  href={`${explorerBase}/${clawdice}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  Clawdice
                </a>
              </li>
              <li>
                <a
                  href={`${explorerBase}/${clawdiceVault}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  Vault
                </a>
              </li>
              <li>
                <a
                  href={`${explorerBase}/${clawToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  CLAW Token
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            Built on Base. Powered by blockhash randomness.
          </p>
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Trifle Labs. MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
}
