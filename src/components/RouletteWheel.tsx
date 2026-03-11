"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// European roulette wheel order (clockwise from 0)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Red numbers in European roulette
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type BetColor = "red" | "black";

export function getPocketColor(number: number): "red" | "black" | "green" {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

// Wheel indices by color
const RED_POCKET_INDICES = WHEEL_ORDER.reduce<number[]>((acc, num, idx) => {
  if (RED_NUMBERS.has(num)) acc.push(idx);
  return acc;
}, []); // 18 red pockets

const BLACK_POCKET_INDICES = WHEEL_ORDER.reduce<number[]>((acc, num, idx) => {
  if (num !== 0 && !RED_NUMBERS.has(num)) acc.push(idx);
  return acc;
}, []); // 18 black pockets

const GREEN_POCKET_INDICES = [0]; // pocket at wheel index 0 = number 0

// Odds constants: European roulette red/black = 18/37, with 1% house edge
const ROULETTE_ODDS = 18 / 37; // ~48.649%
const HOUSE_EDGE = 0.01;
export const ADJUSTED_WIN_CHANCE = ROULETTE_ODDS * (1 - HOUSE_EDGE) * 100; // ~48.162%

const SLICE_DEGREES = 360 / 37;

/**
 * Reverse-engineers the target wheel index based on the result and outcome.
 * Ensures the wheel lands on a pocket of the correct color (matching the outcome).
 */
function computeTargetWheelIndex(
  resultPosition: number,
  won: boolean,
  betColor: BetColor
): number {
  const winPockets =
    betColor === "red" ? RED_POCKET_INDICES : BLACK_POCKET_INDICES;
  const losePockets =
    betColor === "red"
      ? [...GREEN_POCKET_INDICES, ...BLACK_POCKET_INDICES]
      : [...GREEN_POCKET_INDICES, ...RED_POCKET_INDICES];

  if (won) {
    const idx = Math.min(
      Math.floor((resultPosition / ADJUSTED_WIN_CHANCE) * winPockets.length),
      winPockets.length - 1
    );
    return winPockets[idx];
  } else {
    const loseRange = 100 - ADJUSTED_WIN_CHANCE;
    const offset = resultPosition - ADJUSTED_WIN_CHANCE;
    const idx = Math.min(
      Math.floor((offset / loseRange) * losePockets.length),
      losePockets.length - 1
    );
    return losePockets[Math.max(0, idx)];
  }
}

interface RouletteWheelProps {
  isSpinning: boolean;
  resultPosition: number | null;
  won: boolean | null;
  betColor: BetColor;
  size?: number;
  onSpinComplete?: () => void;
}

/**
 * RouletteWheel - European roulette wheel with reverse-engineered landing.
 *
 * The wheel has 37 pockets (18 red, 18 black, 1 green) arranged in the
 * standard European single-zero order. When the result arrives the wheel
 * is reverse-engineered to land on a pocket whose color matches the outcome,
 * so the visual always agrees with the contract result.
 *
 * Odds are proportional to the wheel area: red covers 18/37 ≈ 48.65%,
 * black covers 18/37 ≈ 48.65%, and green covers 1/37 ≈ 2.7%.
 */
export function RouletteWheel({
  isSpinning,
  resultPosition,
  won,
  betColor,
  size = 220,
  onSpinComplete,
}: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing" | "done">(
    "idle"
  );
  const [landedPocketIdx, setLandedPocketIdx] = useState<number | null>(null);
  const animationFrameRef = useRef<number>();
  const spinRotationRef = useRef(0);

  // Compute target degrees when result arrives
  const targetDegrees =
    resultPosition !== null && won !== null
      ? (() => {
          const wheelIdx = computeTargetWheelIndex(resultPosition, won, betColor);
          return (wheelIdx + 0.5) * SLICE_DEGREES;
        })()
      : 0;

  // Handle phase transitions
  useEffect(() => {
    if (isSpinning && resultPosition === null && phase === "idle") {
      setPhase("spinning");
      spinRotationRef.current = 0;
      setLandedPocketIdx(null);
    } else if (resultPosition !== null && won !== null && phase === "spinning") {
      setPhase("landing");
    } else if (!isSpinning && resultPosition === null && phase !== "idle") {
      setPhase("idle");
      setRotation(0);
      spinRotationRef.current = 0;
      setLandedPocketIdx(null);
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [phase]);

  // Landing animation
  useEffect(() => {
    if (phase !== "landing") return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const currentRot = spinRotationRef.current;
    const currentAngle = ((currentRot % 360) + 360) % 360;

    // Always go forward (clockwise)
    let delta = targetDegrees - currentAngle;
    if (delta <= 0) delta += 360;

    // 3 full extra spins for drama, then land on target pocket
    const finalRotation = currentRot + 3 * 360 + delta;

    setRotation(finalRotation);

    // Record which pocket we landed on
    if (resultPosition !== null && won !== null) {
      const wheelIdx = computeTargetWheelIndex(resultPosition, won, betColor);
      setLandedPocketIdx(wheelIdx);
    }

    const timeoutId = setTimeout(() => {
      setPhase("done");
      onSpinComplete?.();
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [phase, targetDegrees, resultPosition, won, betColor, onSpinComplete]);

  const isLandingAnimation = phase === "landing";
  const center = size / 2;
  const radius = size / 2 - 4;
  const innerRadius = radius * 0.18; // center circle

  const angleToPoint = useCallback(
    (angleDeg: number, r: number) => {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        x: center + r * Math.sin(rad),
        y: center - r * Math.cos(rad),
      };
    },
    [center]
  );

  const slicePath = useCallback(
    (sliceIdx: number, r: number) => {
      const startAngle = sliceIdx * SLICE_DEGREES;
      const endAngle = (sliceIdx + 1) * SLICE_DEGREES;
      const start = angleToPoint(startAngle, r);
      const end = angleToPoint(endAngle, r);
      const startInner = angleToPoint(startAngle, innerRadius);
      const endInner = angleToPoint(endAngle, innerRadius);
      const largeArc = SLICE_DEGREES > 180 ? 1 : 0;
      return [
        `M ${startInner.x} ${startInner.y}`,
        `L ${start.x} ${start.y}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
        `L ${endInner.x} ${endInner.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
        "Z",
      ].join(" ");
    },
    [angleToPoint, innerRadius]
  );

  const landedNumber =
    landedPocketIdx !== null ? WHEEL_ORDER[landedPocketIdx] : null;
  const landedColor =
    landedNumber !== null ? getPocketColor(landedNumber) : null;

  // Label position for each slice
  const sliceLabelPos = useCallback(
    (sliceIdx: number) => {
      const midAngle = (sliceIdx + 0.5) * SLICE_DEGREES;
      return angleToPoint(midAngle, radius * 0.72);
    },
    [angleToPoint, radius]
  );

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
            <radialGradient id="rouletteRedGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="100%" stopColor="#C0392B" />
            </radialGradient>
            <radialGradient id="rouletteBlackGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4A4A5A" />
              <stop offset="100%" stopColor="#1A1A2A" />
            </radialGradient>
            <radialGradient id="rouletteGreenGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#27AE60" />
              <stop offset="100%" stopColor="#145A32" />
            </radialGradient>
          </defs>

          {/* Slices */}
          {WHEEL_ORDER.map((num, idx) => {
            const color = getPocketColor(num);
            const fillColor =
              color === "red"
                ? "url(#rouletteRedGrad)"
                : color === "black"
                ? "url(#rouletteBlackGrad)"
                : "url(#rouletteGreenGrad)";
            const isLanded = landedPocketIdx === idx && phase === "done";
            return (
              <path
                key={idx}
                d={slicePath(idx, radius)}
                fill={fillColor}
                stroke={isLanded ? "#FFD700" : "rgba(255,255,255,0.15)"}
                strokeWidth={isLanded ? 2 : 0.5}
                opacity={isLanded ? 1 : 0.9}
              />
            );
          })}

          {/* Number labels */}
          {WHEEL_ORDER.map((num, idx) => {
            const pos = sliceLabelPos(idx);
            const color = getPocketColor(num);
            const fontSize = size <= 200 ? size * 0.038 : size * 0.042;
            return (
              <text
                key={`label-${idx}`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color === "black" ? "#E0E0E0" : "#FFFFFF"}
                fontSize={fontSize}
                fontWeight="bold"
                style={{ pointerEvents: "none", userSelect: "none" }}
                transform={`rotate(${(idx + 0.5) * SLICE_DEGREES}, ${pos.x}, ${pos.y})`}
              >
                {num}
              </text>
            );
          })}

          {/* Center circle */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="#1A1A2A"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />

          {/* Separator lines between slices */}
          {WHEEL_ORDER.map((_, idx) => {
            const angle = idx * SLICE_DEGREES;
            const outer = angleToPoint(angle, radius);
            const inner = angleToPoint(angle, innerRadius);
            return (
              <line
                key={`sep-${idx}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="0.5"
              />
            );
          })}
        </svg>
      </div>

      {/* Fixed pointer (arrow at top) */}
      <div className="absolute inset-0 pointer-events-none">
        <svg width={size} height={size}>
          {/* Pointer triangle */}
          <polygon
            points={`${center},${center - radius - 2} ${center - 8},${center - radius + 12} ${center + 8},${center - radius + 12}`}
            fill="#FFD700"
            stroke="#B8860B"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Result badge */}
      {phase === "done" && landedNumber !== null && landedColor !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl border-2 border-yellow-400 text-white font-bold text-lg"
            style={{
              backgroundColor:
                landedColor === "red"
                  ? "#C0392B"
                  : landedColor === "black"
                  ? "#1A1A2A"
                  : "#145A32",
            }}
          >
            {landedNumber}
          </div>
        </div>
      )}
    </div>
  );
}
