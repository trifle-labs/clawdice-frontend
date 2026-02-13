"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
 * SpinWheel - A visual representation of provably fair dice outcomes
 * 
 * Shows a circular wheel divided into green (win) and red (lose) sections.
 * A pointer arm spins and lands on the result position.
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
  const [currentRotation, setCurrentRotation] = useState(0);
  const animationFrameRef = useRef<number>();
  const isLandingRef = useRef(false);

  // Calculate adjusted win chance (accounting for house edge)
  const adjustedWinChance = winChance * (1 - houseEdge / 100);
  
  // Convert to degrees (0° is at top, clockwise)
  const winSectionDegrees = (adjustedWinChance / 100) * 360;
  
  // Calculate result angle (where the pointer should land)
  // Negative rotation because CSS rotates clockwise but our wheel is drawn counter-clockwise
  const resultAngle = resultPosition !== null 
    ? 360 - (resultPosition / 100) * 360
    : 0;

  // Continuous spin animation while waiting
  useEffect(() => {
    if (isSpinning && resultPosition === null && !isLandingRef.current) {
      let rotation = currentRotation;
      const spin = () => {
        rotation += 12; // Fast spin while waiting (degrees per frame)
        setCurrentRotation(rotation);
        controls.set({ rotate: rotation });
        animationFrameRef.current = requestAnimationFrame(spin);
      };
      animationFrameRef.current = requestAnimationFrame(spin);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isSpinning, resultPosition, controls, currentRotation]);

  // Land on result when revealed
  useEffect(() => {
    if (resultPosition !== null && isSpinning && !isLandingRef.current) {
      isLandingRef.current = true;
      
      // Cancel continuous spin
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Calculate final rotation: complete 3-5 more full spins + land on result
      const baseRotation = currentRotation;
      const numSpins = 3 + Math.floor(Math.random() * 3); // 3-5 full spins for drama
      const fullSpins = numSpins * 360; // MUST be multiple of 360 to not affect landing
      
      // The pointer points UP (0°), wheel 0% is at TOP
      // To point at X%, we need to rotate the pointer X% of 360°
      const targetAngle = resultAngle;
      
      // Calculate how much more rotation needed to land on target
      // This handles the case where current angle > target angle correctly
      const currentAngle = baseRotation % 360;
      const additionalRotation = (targetAngle - currentAngle + 360) % 360;
      const finalRotation = baseRotation + fullSpins + additionalRotation;
      
      console.log("SpinWheel landing:", { 
        resultPosition, 
        targetAngle,
        numSpins,
        currentAngle,
        additionalRotation,
        finalRotation,
        finalAngle: finalRotation % 360,
      });
      
      controls.start({
        rotate: finalRotation,
        transition: {
          type: "spring",
          stiffness: 15,
          damping: 8,
          mass: 1.5,
          // This creates: fast spin → dramatic slowdown → slight overshoot → settle
        },
      }).then(() => {
        setCurrentRotation(finalRotation);
        isLandingRef.current = false;
        onSpinComplete?.();
      });
    }
  }, [resultPosition, isSpinning, resultAngle, controls, currentRotation, onSpinComplete]);

  // Reset when starting fresh
  useEffect(() => {
    if (!isSpinning && resultPosition === null) {
      isLandingRef.current = false;
      // Don't reset rotation - keep where it landed for visual continuity
    }
  }, [isSpinning, resultPosition]);

  const center = size / 2;
  const radius = size / 2 - 4;
  const pointerLength = radius * 0.75;

  // Create SVG arc path
  const describeArc = useCallback((startAngle: number, endAngle: number, r: number) => {
    // Convert to radians, offset by -90 to start at top
    const start = ((startAngle - 90) * Math.PI) / 180;
    const end = ((endAngle - 90) * Math.PI) / 180;
    
    const x1 = center + r * Math.cos(start);
    const y1 = center + r * Math.sin(start);
    const x2 = center + r * Math.cos(end);
    const y2 = center + r * Math.sin(end);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${center} ${center} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }, [center]);

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
        
        {/* Win section (green) - starts at top (0°) */}
        <path
          d={describeArc(0, winSectionDegrees, radius)}
          fill="url(#greenGradient)"
          className="drop-shadow-sm"
        />
        
        {/* Lose section (red) */}
        <path
          d={describeArc(winSectionDegrees, 360, radius)}
          fill="url(#redGradient)"
          className="drop-shadow-sm"
        />
        
        {/* Gradients - kawaii palette */}
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
        
        {/* Tick marks for reference */}
        {[0, 25, 50, 75].map((pct) => {
          const angle = ((pct / 100) * 360 - 90) * Math.PI / 180;
          const innerR = radius * 0.85;
          const outerR = radius * 0.95;
          return (
            <line
              key={pct}
              x1={center + innerR * Math.cos(angle)}
              y1={center + innerR * Math.sin(angle)}
              x2={center + outerR * Math.cos(angle)}
              y2={center + outerR * Math.sin(angle)}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      
      {/* Spinning pointer */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={controls}
        initial={{ rotate: 0 }}
        style={{ transformOrigin: "center center" }}
      >
        <svg width={size} height={size}>
          {/* Pointer arm */}
          <line
            x1={center}
            y1={center}
            x2={center}
            y2={center - pointerLength}
            stroke="#4A4A6A"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Pointer tip (arrow) */}
          <polygon
            points={`${center},${center - pointerLength - 10} ${center - 7},${center - pointerLength + 2} ${center + 7},${center - pointerLength + 2}`}
            fill="#4A4A6A"
          />
          {/* Center hub */}
          <circle
            cx={center}
            cy={center}
            r="10"
            fill="#4A4A6A"
          />
          <circle
            cx={center}
            cy={center}
            r="5"
            fill="#B8A9E8"
          />
        </svg>
      </motion.div>
      
      {/* Result badge when complete */}
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

/**
 * Calculate result position from contract data
 * @param scaledResult The scaled result from contract (0 to ~1e18)
 * @returns Position as percentage (0-100)
 */
export function calculateResultPosition(scaledResult: bigint): number {
  const E18 = BigInt("1000000000000000000");
  return Number((scaledResult * BigInt(100)) / E18);
}

/**
 * Calculate result position from raw random hash
 * @param randomResult The raw uint256 result from keccak256
 * @returns Position as percentage (0-100)
 */
export function calculateResultFromRaw(randomResult: bigint): number {
  const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  const E18 = BigInt("1000000000000000000");
  const scaleFactor = MAX_UINT256 / E18;
  const scaledResult = randomResult / scaleFactor;
  return Number((scaledResult * BigInt(100)) / E18);
}
