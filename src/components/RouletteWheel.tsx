"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";

export type BetColor = "red" | "black";

// 37 equal-sized slices (like European roulette: 36 coloured + 1 green)
const TOTAL_SLICES = 37;
const SLICE_DEG = 360 / TOTAL_SLICES; // ≈ 9.73°

/**
 * Distribute win/lose slices around the wheel using Bresenham's line
 * algorithm.  This produces the most evenly-spaced alternating pattern
 * possible for any win:lose ratio.
 *
 *   50% odds → WLWLWL… (perfect alternation, 18 each)
 *   75% odds → LWWWLWWW… (9 L, 27 W — 3× more win slices)
 *   25% odds → LLLWLLLW… (27 L, 9 W — 3× more lose slices)
 *
 * Green is inserted at index 0 as the single house-edge marker.
 */
function buildSliceLayout(odds: number): Array<"win" | "lose" | "green"> {
  const numColored = TOTAL_SLICES - 1; // 36
  // Clamp so there is always at least 1 win slice and 1 lose slice
  const numWin = Math.min(Math.max(Math.round(numColored * (odds / 100)), 1), numColored - 1);
  const colored: Array<"win" | "lose"> = [];
  let err = 0;
  for (let i = 0; i < numColored; i++) {
    err += numWin;
    if (err >= numColored) {
      err -= numColored;
      colored.push("win");
    } else {
      colored.push("lose");
    }
  }
  return ["green", ...colored];
}

/**
 * Select which specific slice to land on given the contract result.
 * Win slices are distributed proportionally across the win-result range
 * [0, adjustedWinChance); lose slices across [adjustedWinChance, 100).
 * This guarantees the pointer always stops on the correct colour.
 */
function computeTargetSlice(
  resultPosition: number,
  won: boolean,
  sliceLayout: Array<"win" | "lose" | "green">,
  adjustedWinChance: number
): number {
  const winIndices = sliceLayout.reduce<number[]>(
    (acc, c, i) => { if (c === "win") acc.push(i); return acc; },
    []
  );
  const loseIndices = sliceLayout.reduce<number[]>(
    (acc, c, i) => { if (c === "lose") acc.push(i); return acc; },
    []
  );

  if (won) {
    // Guard: if somehow winIndices is empty fall back to slice 1
    if (winIndices.length === 0) return 1;
    const frac = Math.min(Math.max(resultPosition / adjustedWinChance, 0), 1 - Number.EPSILON);
    return winIndices[Math.floor(frac * winIndices.length)];
  } else {
    // Guard: if somehow loseIndices is empty fall back to last slice
    if (loseIndices.length === 0) return TOTAL_SLICES - 1;
    const loseRange = 100 - adjustedWinChance;
    const frac = Math.min(
      Math.max((resultPosition - adjustedWinChance) / loseRange, 0),
      1 - Number.EPSILON
    );
    return loseIndices[Math.floor(frac * loseIndices.length)];
  }
}

interface RouletteWheelProps {
  /** Win-chance percentage (5–95), chosen by the player */
  odds: number;
  /** House edge percentage (default 1) */
  houseEdge?: number;
  isSpinning: boolean;
  resultPosition: number | null;
  won: boolean | null;
  betColor: BetColor;
  size?: number;
  onSpinComplete?: () => void;
}

/**
 * RouletteWheel — 37 equal-sized alternating slices that visually
 * mirror a real roulette wheel.
 *
 * The number of win-colour vs lose-colour slices is proportional to the
 * chosen odds: at 75% the wheel has 27 win-colour and 9 lose-colour slices
 * (3:1 ratio), distributed evenly using Bresenham's algorithm so the wheel
 * always looks naturally alternating regardless of the odds.
 *
 * Landing is reverse-engineered: the contract result determines which
 * specific slice of the correct colour the wheel stops on, so the
 * visual always agrees with the outcome.
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
  const adjustedWinChance = odds * (1 - houseEdge / 100);
  const sliceLayout = useMemo(() => buildSliceLayout(odds), [odds]);

  // Reverse-engineer the exact slice to land on and convert to degrees
  const targetDegrees = useMemo(() => {
    if (resultPosition === null || won === null) return 0;
    const sliceIdx = computeTargetSlice(
      resultPosition, won, sliceLayout, adjustedWinChance
    );
    return (sliceIdx + 0.5) * SLICE_DEG; // centre of the target slice
  }, [resultPosition, won, sliceLayout, adjustedWinChance]);

  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing" | "done">("idle");
  const [landedSliceIdx, setLandedSliceIdx] = useState<number | null>(null);
  const animationFrameRef = useRef<number>();
  const spinRotationRef = useRef(0);

  // Phase transitions
  useEffect(() => {
    if (isSpinning && resultPosition === null && phase === "idle") {
      setPhase("spinning");
      spinRotationRef.current = 0;
      setLandedSliceIdx(null);
    } else if (resultPosition !== null && won !== null && phase === "spinning") {
      setPhase("landing");
    } else if (!isSpinning && resultPosition === null && phase !== "idle") {
      setPhase("idle");
      setRotation(0);
      spinRotationRef.current = 0;
      setLandedSliceIdx(null);
    }
  }, [isSpinning, resultPosition, won, phase]);

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

  // Landing: 3 extra full spins then decelerate to target slice
  useEffect(() => {
    if (phase !== "landing") return;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const currentRot = spinRotationRef.current;
    const currentAngle = ((currentRot % 360) + 360) % 360;
    // CSS rotate(R) moves a slice at wheel angle θ to screen angle θ+R.
    // To land the slice under the top pointer we need R = (360 - θ) mod 360.
    const neededAngle = (360 - targetDegrees) % 360;
    let delta = neededAngle - currentAngle;
    if (delta <= 0) delta += 360; // always go forward
    const finalRotation = currentRot + 3 * 360 + delta;
    setRotation(finalRotation);

    if (resultPosition !== null && won !== null) {
      setLandedSliceIdx(computeTargetSlice(resultPosition, won, sliceLayout, adjustedWinChance));
    }

    const timeoutId = setTimeout(() => {
      setPhase("done");
      onSpinComplete?.();
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [phase, targetDegrees, resultPosition, won, sliceLayout, adjustedWinChance, onSpinComplete]);

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

  // Annular sector path for one slice
  const slicePath = useCallback(
    (sliceIdx: number) => {
      const startDeg = sliceIdx * SLICE_DEG;
      const endDeg = (sliceIdx + 1) * SLICE_DEG;
      const s = angleToPoint(startDeg, radius);
      const e = angleToPoint(endDeg, radius);
      const si = angleToPoint(startDeg, innerRadius);
      const ei = angleToPoint(endDeg, innerRadius);
      const largeArc = 0; // SLICE_DEG ≈ 9.73° — never exceeds 180°
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

  const winFill = betColor === "red" ? "url(#rwRedGrad)" : "url(#rwBlackGrad)";
  const loseFill = betColor === "red" ? "url(#rwBlackGrad)" : "url(#rwRedGrad)";
  const landedColor =
    phase === "done" && won !== null
      ? won ? betColor : betColor === "red" ? "black" : "red"
      : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Static outer ring */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0 drop-shadow-lg pointer-events-none"
      >
        <circle cx={center} cy={center} r={radius + 3} fill="none" stroke="#2D1B4E" strokeWidth="6" />
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

          {/* 37 equal-sized alternating slices */}
          {sliceLayout.map((color, idx) => {
            const fill =
              color === "win" ? winFill
              : color === "lose" ? loseFill
              : "url(#rwGreenGrad)";
            const isLanded = landedSliceIdx === idx && phase === "done";
            return (
              <path
                key={idx}
                d={slicePath(idx)}
                fill={fill}
                stroke={isLanded ? "#FFD700" : "rgba(255,255,255,0.2)"}
                strokeWidth={isLanded ? 2 : 0.5}
              />
            );
          })}

          {/* Centre hub */}
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

      {/* Fixed pointer */}
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
            style={{ backgroundColor: landedColor === "red" ? "#C0392B" : "#1A1A2A" }}
          >
            {won ? "WIN" : "LOSE"}
          </div>
        </div>
      )}
    </div>
  );
}
