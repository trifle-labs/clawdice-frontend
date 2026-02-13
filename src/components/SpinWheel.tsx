"use client";

import { useEffect, useState, useRef } from "react";
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
  const [displayRotation, setDisplayRotation] = useState(0);
  const spinStartRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  // Calculate adjusted win chance (accounting for house edge)
  const adjustedWinChance = winChance * (1 - houseEdge / 100);
  
  // Convert to degrees (0° is at top, clockwise)
  const winSectionDegrees = (adjustedWinChance / 100) * 360;
  
  // Calculate result angle (where the pointer should land)
  const resultAngle = resultPosition !== null 
    ? (resultPosition / 100) * 360 
    : 0;

  // Continuous spin animation while waiting
  useEffect(() => {
    if (isSpinning && resultPosition === null) {
      // Start continuous spinning
      let rotation = spinStartRef.current;
      const spin = () => {
        rotation += 8; // Speed of continuous spin
        setDisplayRotation(rotation);
        animationFrameRef.current = requestAnimationFrame(spin);
      };
      animationFrameRef.current = requestAnimationFrame(spin);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        spinStartRef.current = rotation;
      };
    }
  }, [isSpinning, resultPosition]);

  // Land on result when revealed
  useEffect(() => {
    if (resultPosition !== null && isSpinning) {
      // Cancel continuous spin
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Calculate final rotation: complete 3 more full spins + land on result
      const currentRotation = spinStartRef.current;
      const fullSpins = 3 * 360;
      // Pointer points up (0°), so we need to rotate to point at result
      // Result at 25% means 90° from top, pointer needs to rotate 90°
      const finalRotation = currentRotation + fullSpins + resultAngle - (currentRotation % 360);
      
      controls.start({
        rotate: finalRotation,
        transition: {
          duration: 2.5,
          ease: [0.25, 0.1, 0.25, 1], // Custom cubic-bezier for nice deceleration
        },
      }).then(() => {
        setDisplayRotation(finalRotation);
        spinStartRef.current = finalRotation;
        onSpinComplete?.();
      });
    }
  }, [resultPosition, isSpinning, resultAngle, controls, onSpinComplete]);

  // Reset when not spinning and no result
  useEffect(() => {
    if (!isSpinning && resultPosition === null) {
      spinStartRef.current = 0;
      setDisplayRotation(0);
    }
  }, [isSpinning, resultPosition]);

  const center = size / 2;
  const radius = size / 2 - 4;
  const innerRadius = radius * 0.2;
  const pointerLength = radius * 0.75;

  // Create SVG arc path
  const describeArc = (startAngle: number, endAngle: number, r: number) => {
    // Convert to radians, offset by -90 to start at top
    const start = ((startAngle - 90) * Math.PI) / 180;
    const end = ((endAngle - 90) * Math.PI) / 180;
    
    const x1 = center + r * Math.cos(start);
    const y1 = center + r * Math.sin(start);
    const x2 = center + r * Math.cos(end);
    const y2 = center + r * Math.sin(end);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${center} ${center} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

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
        
        {/* Center circle */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="white"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="2"
        />
        
        {/* Gradients */}
        <defs>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        
        {/* Win/Lose labels */}
        <text
          x={center + (radius * 0.5) * Math.cos(((winSectionDegrees / 2) - 90) * Math.PI / 180)}
          y={center + (radius * 0.5) * Math.sin(((winSectionDegrees / 2) - 90) * Math.PI / 180)}
          fill="white"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
          className="select-none"
        >
          WIN
        </text>
        <text
          x={center + (radius * 0.6) * Math.cos((((360 - winSectionDegrees) / 2 + winSectionDegrees) - 90) * Math.PI / 180)}
          y={center + (radius * 0.6) * Math.sin((((360 - winSectionDegrees) / 2 + winSectionDegrees) - 90) * Math.PI / 180)}
          fill="white"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
          className="select-none"
        >
          LOSE
        </text>
      </svg>
      
      {/* Spinning pointer */}
      <motion.div
        className="absolute inset-0"
        animate={resultPosition !== null ? controls : undefined}
        style={{ 
          rotate: resultPosition === null ? displayRotation : undefined,
          transformOrigin: "center center",
        }}
      >
        <svg width={size} height={size}>
          {/* Pointer arm */}
          <line
            x1={center}
            y1={center}
            x2={center}
            y2={center - pointerLength}
            stroke="#1f2937"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Pointer tip */}
          <polygon
            points={`${center},${center - pointerLength - 8} ${center - 6},${center - pointerLength + 4} ${center + 6},${center - pointerLength + 4}`}
            fill="#1f2937"
          />
          {/* Center dot */}
          <circle
            cx={center}
            cy={center}
            r="8"
            fill="#1f2937"
          />
        </svg>
      </motion.div>
      
      {/* Result indicator when landed */}
      {resultPosition !== null && !isSpinning && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          <div className={`
            px-3 py-1 rounded-full text-white text-sm font-bold
            ${resultPosition < adjustedWinChance ? "bg-green-500" : "bg-red-500"}
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
  // scaledResult is in range 0 to 1e18
  // Convert to 0-100 percentage
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
