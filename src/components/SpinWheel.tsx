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
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'landing' | 'done'>('idle');
  const animationFrameRef = useRef<number>();
  const spinRotationRef = useRef(0);

  const adjustedWinChance = winChance * (1 - houseEdge / 100);
  const greenEndDegrees = (adjustedWinChance / 100) * 360;
  const targetDegrees = resultPosition !== null ? (resultPosition / 100) * 360 : 0;

  // Handle phase transitions
  useEffect(() => {
    if (isSpinning && resultPosition === null && phase === 'idle') {
      setPhase('spinning');
      spinRotationRef.current = 0;
    } else if (resultPosition !== null && phase === 'spinning') {
      setPhase('landing');
    } else if (!isSpinning && resultPosition === null && phase !== 'idle') {
      setPhase('idle');
      setRotation(0);
      spinRotationRef.current = 0;
    }
  }, [isSpinning, resultPosition, phase]);

  // Continuous spin animation (fast - matches landing speed)
  useEffect(() => {
    if (phase !== 'spinning') return;
    
    const spin = () => {
      spinRotationRef.current += 18; // Fast spin like during reveal
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
    if (phase !== 'landing') return;
    
    // Cancel any ongoing spin
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Continue from current position, add spins, land on target (clockwise)
    const currentRot = spinRotationRef.current;
    const currentAngle = ((currentRot % 360) + 360) % 360;
    
    // Calculate delta to reach target going forward (clockwise)
    let delta = targetDegrees - currentAngle;
    if (delta <= 0) delta += 360; // Always go forward
    
    // Add 3 full spins for drama, then land on target
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
    
    // Start landing animation from current position
    setRotation(finalRotation);
    
    // Mark as done after animation completes
    const timeoutId = setTimeout(() => {
      setPhase('done');
      onSpinComplete?.();
    }, 3000);
    
    return () => clearTimeout(timeoutId);
  }, [phase, targetDegrees, resultPosition, onSpinComplete]);

  const isLandingAnimation = phase === 'landing';

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

  // Calculate multiplier and position for label in green zone
  const multiplier = 100 / winChance;
  const multiplierText = multiplier >= 10 ? `${multiplier.toFixed(0)}x` : `${multiplier.toFixed(1)}x`;
  const greenCenterAngle = greenEndDegrees / 2; // Center of green zone
  const labelRadius = radius * 0.6; // Position label at 60% of radius
  const labelPos = angleToPoint(greenCenterAngle, labelRadius);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="drop-shadow-lg">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
        
        {/* Green (win) section */}
        <path d={arcPath(0, greenEndDegrees, radius)} fill="url(#greenGradient)" />
        
        {/* Multiplier label in green zone */}
        <text
          x={labelPos.x}
          y={labelPos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#2D5A4A"
          fontSize={size * 0.12}
          fontWeight="bold"
          style={{ pointerEvents: 'none' }}
        >
          {multiplierText}
        </text>
        
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
        
      </svg>
      
      {/* Arrow - using CSS transform */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: isLandingAnimation ? 'transform 3s cubic-bezier(0.0, 0.0, 0.2, 1)' : 'none',
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
      
      {/* Result badge - only show after wheel stops */}
      {phase === 'done' && resultPosition !== null && (
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
