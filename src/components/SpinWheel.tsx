"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";

interface SpinWheelProps {
  /** Win probability as percentage (0-100) */
  winChance: number;
  /** House edge as percentage (default 1%) */
  houseEdge?: number;
  /** Whether the wheel is currently spinning */
  isSpinning: boolean;
  /** The result position (0-100), null if not yet revealed */
  resultPosition: number | null;
  /** Size in pixels */
  size?: number;
  /** Called when spin animation completes */
  onSpinComplete?: () => void;
}

/**
 * SpinWheel - Visual wheel for provably fair dice outcomes
 * 
 * Layout (like a clock):
 * - 0% at 12 o'clock (top)
 * - 25% at 3 o'clock (right)
 * - 50% at 6 o'clock (bottom)
 * - 75% at 9 o'clock (left)
 * 
 * For 50% win chance:
 * - Green (win): RIGHT side (12→3→6)
 * - Red (lose): LEFT side (6→9→12)
 */
export function SpinWheel({
  winChance,
  houseEdge = 1,
  isSpinning,
  resultPosition,
  size = 200,
  onSpinComplete,
}: SpinWheelProps) {
  const controls = useAnimation();
  // Use ref for rotation to avoid async state issues
  const rotationRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const isLandingRef = useRef(false);

  // Adjusted win chance (accounting for house edge)
  const adjustedWinChance = winChance * (1 - houseEdge / 100);
  
  // Green section spans 0° to this angle
  const greenEndDegrees = (adjustedWinChance / 100) * 360;
  
  // Arrow target: convert result percentage to degrees
  // 0% = 0° (top), 25% = 90° (right), 50% = 180° (bottom), 75% = 270° (left)
  const targetDegrees = resultPosition !== null 
    ? (resultPosition / 100) * 360
    : 0;

  // Continuous spin while waiting for result
  useEffect(() => {
    if (isSpinning && resultPosition === null && !isLandingRef.current) {
      const spin = () => {
        rotationRef.current += 12;
        controls.set({ rotate: rotationRef.current });
        animationFrameRef.current = requestAnimationFrame(spin);
      };
      animationFrameRef.current = requestAnimationFrame(spin);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isSpinning, resultPosition, controls]);

  // Land on result
  useEffect(() => {
    if (resultPosition !== null && isSpinning && !isLandingRef.current) {
      isLandingRef.current = true;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Use ref value directly - no async state issues
      const baseRotation = rotationRef.current;
      const numSpins = 3 + Math.floor(Math.random() * 3);
      const fullSpins = numSpins * 360;
      
      // Calculate rotation to land on target
      const currentAngle = ((baseRotation % 360) + 360) % 360;
      const target = ((targetDegrees % 360) + 360) % 360;
      let delta = target - currentAngle;
      if (delta < 0) delta += 360;
      
      const finalRotation = baseRotation + fullSpins + delta;
      
      console.log("SpinWheel:", { 
        resultPosition,
        targetDegrees,
        baseRotation,
        currentAngle,
        target,
        delta,
        finalRotation,
        finalAngle: finalRotation % 360,
      });
      
      controls.start({
        rotate: finalRotation,
        transition: {
          duration: 3,
          ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for smooth deceleration
        },
      }).then(() => {
        rotationRef.current = finalRotation;
        isLandingRef.current = false;
        onSpinComplete?.();
      });
    }
  }, [resultPosition, isSpinning, targetDegrees, controls, onSpinComplete]);

  // Reset on new spin
  useEffect(() => {
    if (!isSpinning && resultPosition === null) {
      isLandingRef.current = false;
      rotationRef.current = 0;
      controls.set({ rotate: 0 });
    }
  }, [isSpinning, resultPosition, controls]);

  const center = size / 2;
  const radius = size / 2 - 4;
  const pointerLength = radius * 0.75;

  /**
   * Convert our angle (0° = top, clockwise) to SVG point
   */
  const angleToPoint = useCallback((angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + r * Math.sin(rad),
      y: center - r * Math.cos(rad),
    };
  }, [center]);

  /**
   * Create SVG arc path from startAngle to endAngle (clockwise)
   */
  const arcPath = useCallback((startAngle: number, endAngle: number, r: number) => {
    const start = angleToPoint(startAngle, r);
    const end = angleToPoint(endAngle, r);
    const angleDiff = endAngle - startAngle;
    const largeArc = angleDiff > 180 ? 1 : 0;
    // sweep = 1 means clockwise in SVG (when Y points down)
    return `M ${center} ${center} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  }, [center, angleToPoint]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="drop-shadow-lg">
        {/* Outer ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="2"
        />
        
        {/* Green (win) section: 0° to greenEndDegrees */}
        <path
          d={arcPath(0, greenEndDegrees, radius)}
          fill="url(#greenGradient)"
          className="drop-shadow-sm"
        />
        
        {/* Red (lose) section: greenEndDegrees to 360° */}
        <path
          d={arcPath(greenEndDegrees, 360, radius)}
          fill="url(#redGradient)"
          className="drop-shadow-sm"
        />
        
        <defs>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A8E6CF" />
            <stop offset="100%" stopColor="#7DD4B0" />
          </linearGradient>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E879A0" />
            <stop offset="100%" stopColor="#D35D8A" />
          </linearGradient>
        </defs>
        
        {/* Quarter tick marks with labels */}
        {[0, 25, 50, 75].map((pct) => {
          const p1 = angleToPoint((pct / 100) * 360, radius * 0.85);
          const p2 = angleToPoint((pct / 100) * 360, radius * 0.95);
          const pLabel = angleToPoint((pct / 100) * 360, radius * 0.7);
          return (
            <g key={pct}>
              <line
                x1={p1.x} y1={p1.y}
                x2={p2.x} y2={p2.y}
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="2"
              />
              <text
                x={pLabel.x}
                y={pLabel.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(0,0,0,0.5)"
                fontSize="10"
                fontWeight="bold"
              >
                {pct}
              </text>
            </g>
          );
        })}
        
        {/* Debug: Show where result SHOULD land (static marker on wheel) */}
        {resultPosition !== null && (
          <>
            {(() => {
              const angle = (resultPosition / 100) * 360;
              const p = angleToPoint(angle, radius * 0.5);
              return (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="blue"
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })()}
          </>
        )}
      </svg>
      
      {/* Spinning pointer */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={controls}
        initial={{ rotate: 0 }}
        style={{ transformOrigin: "center center" }}
      >
        <svg width={size} height={size}>
          <line
            x1={center}
            y1={center}
            x2={center}
            y2={center - pointerLength}
            stroke="#4A4A6A"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <polygon
            points={`${center},${center - pointerLength - 10} ${center - 7},${center - pointerLength + 2} ${center + 7},${center - pointerLength + 2}`}
            fill="#4A4A6A"
          />
          <circle cx={center} cy={center} r="10" fill="#4A4A6A" />
          <circle cx={center} cy={center} r="5" fill="#B8A9E8" />
        </svg>
      </motion.div>
      
      {/* Result badge */}
      {resultPosition !== null && !isSpinning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`
            px-3 py-1.5 rounded-full text-white text-sm font-bold shadow-lg
            ${resultPosition < adjustedWinChance ? "bg-[#7DD4B0]" : "bg-[#E879A0]"}
          `}>
            {resultPosition.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

/** Convert scaled contract result to percentage */
export function calculateResultPosition(scaledResult: bigint): number {
  const E18 = BigInt("1000000000000000000");
  return Number((scaledResult * BigInt(100)) / E18);
}

/** Convert raw hash to percentage */
export function calculateResultFromRaw(randomResult: bigint): number {
  const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  const E18 = BigInt("1000000000000000000");
  const scaleFactor = MAX_UINT256 / E18;
  const scaledResult = randomResult / scaleFactor;
  return Number((scaledResult * BigInt(100)) / E18);
}
