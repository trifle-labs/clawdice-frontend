"use client";

import { useEffect, useState } from "react";

// Detect if visitor is likely an AI agent based on user agent or headers
export function useAgentDetection(): { isAgent: boolean; agentType: string | null } {
  const [detection, setDetection] = useState<{ isAgent: boolean; agentType: string | null }>({
    isAgent: false,
    agentType: null,
  });

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();

    // Check for common AI agent patterns
    const agentPatterns: { pattern: RegExp; type: string }[] = [
      { pattern: /claude/i, type: "Claude" },
      { pattern: /anthropic/i, type: "Claude" },
      { pattern: /openai/i, type: "OpenAI" },
      { pattern: /gpt/i, type: "OpenAI" },
      { pattern: /cursor/i, type: "Cursor" },
      { pattern: /openclaw/i, type: "OpenClaw" },
      { pattern: /agent/i, type: "AI Agent" },
      { pattern: /bot(?!tom)/i, type: "Bot" },
      { pattern: /headless/i, type: "Headless" },
      { pattern: /playwright/i, type: "Playwright" },
      { pattern: /puppeteer/i, type: "Puppeteer" },
    ];

    for (const { pattern, type } of agentPatterns) {
      if (pattern.test(ua)) {
        setDetection({ isAgent: true, agentType: type });
        return;
      }
    }

    // Also check for automation flags
    if (typeof window !== "undefined") {
      const nav = navigator as unknown as { webdriver?: boolean };
      if (nav.webdriver) {
        setDetection({ isAgent: true, agentType: "Automated Browser" });
        return;
      }
    }

    setDetection({ isAgent: false, agentType: null });
  }, []);

  return detection;
}

// Component that shows different content for agents vs humans
export function AgentGate({
  agentContent,
  humanContent,
}: {
  agentContent: React.ReactNode;
  humanContent: React.ReactNode;
}) {
  const { isAgent } = useAgentDetection();
  const [mode, setMode] = useState<"auto" | "agent" | "human">("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  const showAgentContent = mode === "agent" || (mode === "auto" && isAgent);

  return (
    <div>
      {/* Mode toggle for testing */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="glass rounded-lg p-2 flex gap-1 text-xs">
          <button
            onClick={() => setMode("auto")}
            className={`px-2 py-1 rounded ${mode === "auto" ? "bg-primary text-white" : "hover:bg-white/10"}`}
          >
            Auto
          </button>
          <button
            onClick={() => setMode("agent")}
            className={`px-2 py-1 rounded ${mode === "agent" ? "bg-primary text-white" : "hover:bg-white/10"}`}
          >
            Agent
          </button>
          <button
            onClick={() => setMode("human")}
            className={`px-2 py-1 rounded ${mode === "human" ? "bg-primary text-white" : "hover:bg-white/10"}`}
          >
            Human
          </button>
        </div>
      </div>

      {showAgentContent ? agentContent : humanContent}
    </div>
  );
}
