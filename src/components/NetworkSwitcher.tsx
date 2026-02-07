"use client";

import { useState } from "react";
import { ChevronDown, Circle } from "lucide-react";
import { NETWORKS, DEFAULT_NETWORK } from "@/lib/networks";

interface NetworkSwitcherProps {
  currentNetwork: string;
  onNetworkChange: (networkId: string) => void;
}

export function NetworkSwitcher({ currentNetwork, onNetworkChange }: NetworkSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const current = NETWORKS[currentNetwork] || NETWORKS[DEFAULT_NETWORK];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-sm"
      >
        <Circle
          className={`w-2 h-2 ${current.isLive ? "fill-success text-success" : "fill-gray-500 text-gray-500"}`}
        />
        <span>{current.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-48 glass rounded-lg shadow-xl z-50 overflow-hidden">
            {Object.entries(NETWORKS).map(([id, network]) => (
              <button
                key={id}
                onClick={() => {
                  if (network.isLive) {
                    onNetworkChange(id);
                  }
                  setIsOpen(false);
                }}
                disabled={!network.isLive}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  network.isLive
                    ? "hover:bg-white/10 cursor-pointer"
                    : "opacity-50 cursor-not-allowed"
                } ${currentNetwork === id ? "bg-primary/20" : ""}`}
              >
                <Circle
                  className={`w-2 h-2 ${
                    network.isLive ? "fill-success text-success" : "fill-gray-500 text-gray-500"
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium">{network.name}</p>
                  <p className="text-xs text-gray-400">
                    {network.isLive ? "Live" : "Coming Soon"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
