import { Github, Twitter } from "lucide-react";
import Link from "next/link";
import { getActiveNetwork } from "@/lib/networks";

export function Footer() {
  const network = getActiveNetwork();
  const { clawdice } = network.contracts;
  const explorer = "https://sepolia.basescan.org/address";

  return (
    <footer className="border-t border-primary/20 bg-white/50 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-shimmer">
              Clawdice
            </Link>
            <span className="text-foreground/30">·</span>
            <a
              href={`${explorer}/${clawdice}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-foreground/50 hover:text-foreground/70"
            >
              Contracts
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/trifle-labs/clawdice"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/50 hover:text-foreground/70"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com/trifle_labs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/50 hover:text-foreground/70"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <span className="text-xs text-foreground/40">
              © {new Date().getFullYear()} Trifle Labs
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
