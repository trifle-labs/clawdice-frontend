"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type BetColor = "red" | "black";

// Sub-slices per color sector for roulette-style visual texture
const SLICES_PER_SECTOR = 18;
// Minimum size (degrees) for the house-edge sector so it always stays visible
const MIN_HOUSE_EDGE_DEG = 3.6; // 1% of 360°
// Skip rendering a sector whose angular span is smaller than this threshold
const MIN_SECTOR_DEG = 0.5;

interface RouletteWheelProps {
  odds: number;                  // Win chance percentage (5–95)
  houseEdge?: number;            // House edge percentage (default 1)
  isSpinning: boolean;
  resultPosition: number | null; // 0–100 raw position from contract
  won: boolean | null;           // Win/loss from contract event
  betColor: BetColor;
  size?: number;
  onSpinComplete?: () => void;
}

/**
 * RouletteWheel - Proportional roulette wheel whose sector sizes reflect
 * the chosen odds.
 *
 * Layout in the wheel's coordinate system (0° = top, clockwise):
 *   0°         → winEndDeg   : bet color (win zone, odds% of wheel)
 *   winEndDeg  → houseEndDeg : green house-edge sliver
 *   houseEndDeg → 360°       : opposite color (lose zone)
 *
 * The wheel rotates so that `(resultPosition / 100) * 360°` aligns with the
 * fixed pointer at the top.  Since the win zone starts at 0°, the pointer
 * lands in the correct zone whenever resultPosition < adjustedWinChance.
 */
export function RouletteWheel({
  odds,
  houseEdge = 1,
  isSpinning,
  resultPosition,
  won,
  betColor,
  size = 220,
  onSpinComplete,
}: RouletteWheelProps) {
  // Adjusted win chance: contract threshold after applying house edge
  const adjustedWinChance = odds * (1 - houseEdge / 100);

  // Sector boundaries in degrees
  const winEndDeg = (adjustedWinChance / 100) * 360;
  const houseDeg = Math.max(MIN_HOUSE_EDGE_DEG, (houseEdge / 100) * 360);
  const houseEndDeg = winEndDeg + houseDeg;

  // Target landing angle: maps resultPosition 0–100 → 0–360°
  const targetDegrees = resultPosition !== null ? (resultPosition / 100) * 360 : 0;

  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing" | "done">("idle");
  const animationFrameRef = useRef<number>();
  const spinRotationRef = useRef(0);

  // Phase transitions
  useEffect(() => {
    if (isSpinning && resultPosition === null && phase === "idle") {
      setPhase("spinning");
      spinRotationRef.current = 0;
    } else if (resultPosition !== null && phase === "spinning") {
      setPhase("landing");
    } else if (!isSpinning && resultPosition === null && phase !== "idle") {
      setPhase("idle");
      setRotation(0);
      spinRotationRef.current = 0;
    }
  }, [isSpinning, resultPosition, phase]);

  // Continuous spin animation
  useEffect(() => {
    if (phase !== "spinning") return;
    const spin = () => {
      spinRotationRef.current += 18;
      setRotation(spinRotationRef.current);
      animationFrameRef.current = requestAnimationFrame(spin);
    };
    animationFrameRef.current = requestAnimationFrame(spin);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [phase]);

  // Landing animation: 3 full extra spins then decelerate onto target
  useEffect(() => {
    if (phase !== "landing") return;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const currentRot = spinRotationRef.current;
    const currentAngle = ((currentRot % 360) + 360) % 360;
    let delta = targetDegrees - currentAngle;
    if (delta <= 0) delta += 360; // always go forward
    const finalRotation = currentRot + 3 * 360 + delta;
    setRotation(finalRotation);

    const timeoutId = setTimeout(() => {
      setPhase("done");
      onSpinComplete?.();
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [phase, targetDegrees, onSpinComplete]);

  const isLandingAnimation = phase === "landing";
  const center = size / 2;
  const radius = size / 2 - 4;
  const innerRadius = radius * 0.18;

  const angleToPoint = useCallback(
    (angleDeg: number, r: number) => {
      const rad = (angleDeg * Math.PI) / 180;
      return { x: center + r * Math.sin(rad), y: center - r * Math.cos(rad) };
    },
    [center]
  );

  // Annular sector path between two angles
  const sectorPath = useCallback(
    (startDeg: number, endDeg: number) => {
      const s = angleToPoint(startDeg, radius);
      const e = angleToPoint(endDeg, radius);
      const si = angleToPoint(startDeg, innerRadius);
      const ei = angleToPoint(endDeg, innerRadius);
      const largeArc = endDeg - startDeg > 180 ? 1 : 0;
      return [
        `M ${si.x} ${si.y}`,
        `L ${s.x} ${s.y}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`,
        `L ${ei.x} ${ei.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${si.x} ${si.y}`,
        "Z",
      ].join(" ");
    },
    [angleToPoint, radius, innerRadius]
  );

  // Split sector [startDeg, endDeg] into `n` equal sub-slices for texture
  const buildSubSlices = useCallback(
    (startDeg: number, endDeg: number, n: number): string[] => {
      const sliceDeg = (endDeg - startDeg) / n;
      return Array.from({ length: n }, (_, i) =>
        sectorPath(startDeg + i * sliceDeg, startDeg + (i + 1) * sliceDeg)
      );
    },
    [sectorPath]
  );

  const winFill = betColor === "red" ? "url(#rwRedGrad)" : "url(#rwBlackGrad)";
  const loseFill = betColor === "red" ? "url(#rwBlackGrad)" : "url(#rwRedGrad)";

  // Result badge: use `won` from contract so it's always accurate
  const landedColor =
    phase === "done" && won !== null
      ? won
        ? betColor
        : betColor === "red"
        ? "black"
        : "red"
      : null;

  const winSubSlices = winEndDeg > MIN_SECTOR_DEG ? buildSubSlices(0, winEndDeg, SLICES_PER_SECTOR) : [];
  const loseSubSlices = houseEndDeg < 360 - MIN_SECTOR_DEG ? buildSubSlices(houseEndDeg, 360, SLICES_PER_SECTOR) : [];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Static outer ring */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0 drop-shadow-lg pointer-events-none"
      >
        <circle
          cx={center}
          cy={center}
          r={radius + 3}
          fill="none"
          stroke="#2D1B4E"
          strokeWidth="6"
        />
      </svg>

      {/* Rotating wheel */}
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
          transition: isLandingAnimation
            ? "transform 3s cubic-bezier(0.0, 0.0, 0.2, 1)"
            : "none",
        }}
      >
        <svg width={size} height={size}>
          <defs>
            <radialGradient id="rwRedGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="100%" stopColor="#C0392B" />
            </radialGradient>
            <radialGradient id="rwBlackGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4A4A5A" />
              <stop offset="100%" stopColor="#1A1A2A" />
            </radialGradient>
            <radialGradient id="rwGreenGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#27AE60" />
              <stop offset="100%" stopColor="#145A32" />
            </radialGradient>
          </defs>

          {/* Win color sector (bet color) */}
          {winSubSlices.map((d, i) => (
            <path
              key={`win-${i}`}
              d={d}
              fill={winFill}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
            />
          ))}

          {/* House-edge sector (green sliver) */}
          <path
            d={sectorPath(winEndDeg, houseEndDeg)}
            fill="url(#rwGreenGrad)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.5"
          />

          {/* Lose color sector (opposite of bet color) */}
          {loseSubSlices.map((d, i) => (
            <path
              key={`lose-${i}`}
              d={d}
              fill={loseFill}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
            />
          ))}

          {/* Center circle */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="#1A1A2A"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Fixed pointer (arrow at top) */}
      <div className="absolute inset-0 pointer-events-none">
        <svg width={size} height={size}>
          <polygon
            points={`${center},${center - radius - 2} ${center - 8},${center - radius + 12} ${center + 8},${center - radius + 12}`}
            fill="#FFD700"
            stroke="#B8860B"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Result badge */}
      {phase === "done" && landedColor !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="px-3 py-1.5 rounded-full text-white text-sm font-bold shadow-xl border-2 border-yellow-400"
            style={{
              backgroundColor: landedColor === "red" ? "#C0392B" : "#1A1A2A",
            }}
          >
            {won ? "WIN" : "LOSE"}
          </div>
        </div>
      )}
    </div>
  );
}
