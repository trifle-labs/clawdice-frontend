"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface SpinWheelProps {
  winChance: number;
  houseEdge?: number;
  isSpinning: boolean;
  resultPosition: number | null;
  size?: number;
  onSpinComplete?: () => void;
}

/**
 * SpinWheel - Visual wheel for provably fair dice outcomes
 * 
 * Layout: 0% = top, 25% = right, 50% = bottom, 75% = left (clockwise)
 */
export function SpinWheel({
  winChance,
  houseEdge = 1,
  isSpinning,
  resultPosition,
  size = 200,
  onSpinComplete,
}: SpinWheelProps) {
  // Use state for rotation so React re-renders with new transform
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationFrameRef = useRef<number>();
  const rotationRef = useRef(0);

  const adjustedWinChance = winChance * (1 - houseEdge / 100);
  const greenEndDegrees = (adjustedWinChance / 100) * 360;
  const targetDegrees = resultPosition !== null ? (resultPosition / 100) * 360 : 0;

  // Continuous spin while waiting
  useEffect(() => {
    if (isSpinning && resultPosition === null) {
      setIsAnimating(false); // Disable CSS transition during continuous spin
      
      const spin = () => {
        rotationRef.current += 8;
        setRotation(rotationRef.current);
        animationFrameRef.current = requestAnimationFrame(spin);
      };
      animationFrameRef.current = requestAnimationFrame(spin);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isSpinning, resultPosition]);

  // Land on result
  useEffect(() => {
    if (resultPosition !== null && isSpinning) {
      // Cancel continuous spin
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Get current rotation and calculate final
      const currentRot = rotationRef.current;
      const currentAngle = ((currentRot % 360) + 360) % 360;
      
      // Calculate how much more to rotate to reach target
      // Add 3 full spins for visual effect
      let delta = targetDegrees - currentAngle;
      if (delta < 0) delta += 360; // Always go forward
      const finalRotation = currentRot + 3 * 360 + delta;
      
      console.log("SpinWheel landing:", { 
        resultPosition,
        targetDegrees,
        currentRot,
        currentAngle,
        delta,
        finalRotation,
        finalAngle: finalRotation % 360,
      });
      
      // Enable CSS transition and animate to final position
      setIsAnimating(true);
      setRotation(finalRotation);
      
      // Call onSpinComplete after animation
      setTimeout(() => {
        rotationRef.current = finalRotation;
        setIsAnimating(false);
        onSpinComplete?.();
      }, 3050);
    }
  }, [resultPosition, isSpinning, targetDegrees, onSpinComplete]);

  // Reset when not spinning
  useEffect(() => {
    if (!isSpinning && resultPosition === null) {
      rotationRef.current = 0;
      setRotation(0);
      setIsAnimating(false);
    }
  }, [isSpinning, resultPosition]);

  const center = size / 2;
  const radius = size / 2 - 4;
  const pointerLength = radius * 0.75;

  const angleToPoint = useCallback((angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + r * Math.sin(rad),
      y: center - r * Math.cos(rad),
    };
  }, [center]);

  const arcPath = useCallback((startAngle: number, endAngle: number, r: number) => {
    const start = angleToPoint(startAngle, r);
    const end = angleToPoint(endAngle, r);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${center} ${center} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  }, [center, angleToPoint]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="drop-shadow-lg">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
        
        {/* Green (win) section */}
        <path d={arcPath(0, greenEndDegrees, radius)} fill="url(#greenGradient)" />
        
        {/* Red (lose) section */}
        <path d={arcPath(greenEndDegrees, 360, radius)} fill="url(#redGradient)" />
        
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
        
        {/* Quarter labels */}
        {[0, 25, 50, 75].map((pct) => {
          const p = angleToPoint((pct / 100) * 360, radius * 0.7);
          return (
            <text key={pct} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fill="rgba(0,0,0,0.4)" fontSize="10" fontWeight="bold">
              {pct}
            </text>
          );
        })}
        
        {/* Debug: blue dot at target position */}
        {resultPosition !== null && (() => {
          const p = angleToPoint(targetDegrees, radius * 0.5);
          return <circle cx={p.x} cy={p.y} r="6" fill="blue" stroke="white" strokeWidth="2" />;
        })()}
      </svg>
      
      {/* Arrow - using CSS transform */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: isAnimating ? 'transform 3s cubic-bezier(0.15, 0.85, 0.35, 1)' : 'none',
        }}
      >
        <svg width={size} height={size}>
          <line x1={center} y1={center} x2={center} y2={center - pointerLength}
            stroke="#4A4A6A" strokeWidth="4" strokeLinecap="round" />
          <polygon
            points={`${center},${center - pointerLength - 10} ${center - 7},${center - pointerLength + 2} ${center + 7},${center - pointerLength + 2}`}
            fill="#4A4A6A"
          />
          <circle cx={center} cy={center} r="10" fill="#4A4A6A" />
          <circle cx={center} cy={center} r="5" fill="#B8A9E8" />
        </svg>
      </div>
      
      {/* Result badge */}
      {resultPosition !== null && !isSpinning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`px-3 py-1.5 rounded-full text-white text-sm font-bold shadow-lg
            ${resultPosition < adjustedWinChance ? "bg-[#7DD4B0]" : "bg-[#E879A0]"}`}>
            {resultPosition.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

export function calculateResultPosition(scaledResult: bigint): number {
  const E18 = BigInt("1000000000000000000");
  return Number((scaledResult * BigInt(100)) / E18);
}

export function calculateResultFromRaw(randomResult: bigint): number {
  const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  const E18 = BigInt("1000000000000000000");
  const scaleFactor = MAX_UINT256 / E18;
  const scaledResult = randomResult / scaleFactor;
  return Number((scaledResult * BigInt(100)) / E18);
}
