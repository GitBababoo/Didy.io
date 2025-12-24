'use client';

import React, { useRef, useState, useEffect } from 'react';

interface JoystickProps {
  size?: number;
  stickSize?: number;
  baseColor?: string;
  stickColor?: string;
  onMove: (vector: { x: number; y: number }) => void;
  className?: string;
}

export const VirtualJoystick: React.FC<JoystickProps> = ({
  size = 100,
  stickSize = 50,
  baseColor = 'rgba(255, 255, 255, 0.1)',
  stickColor = 'rgba(255, 255, 255, 0.5)',
  onMove,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const touchId = useRef<number | null>(null);

  const handleStart = (e: React.TouchEvent) => {
    // Only accept if not already active
    if (touchId.current !== null) return;
    
    const touch = e.changedTouches[0];
    touchId.current = touch.identifier;
    setActive(true);
    updatePosition(touch.clientX, touch.clientY);
  };

  const handleMove = (e: React.TouchEvent) => {
    if (touchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) {
        updatePosition(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

  const handleEnd = (e: React.TouchEvent) => {
    if (touchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) {
        touchId.current = null;
        setActive(false);
        setPosition({ x: 0, y: 0 });
        onMove({ x: 0, y: 0 });
        break;
      }
    }
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDist = (size / 2) - (stickSize / 2);

    let x = deltaX;
    let y = deltaY;

    // Clamp
    if (distance > maxDist) {
      const angle = Math.atan2(deltaY, deltaX);
      x = Math.cos(angle) * maxDist;
      y = Math.sin(angle) * maxDist;
    }

    setPosition({ x, y });

    // Normalize output (-1 to 1)
    onMove({
      x: x / maxDist,
      y: y / maxDist
    });
  };

  return (
    <div
      ref={containerRef}
      className={`${className} rounded-full touch-none select-none`}
      style={{
        width: size,
        height: size,
        backgroundColor: baseColor,
        position: 'relative',
        backdropFilter: 'blur(4px)'
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      <div
        className="rounded-full shadow-lg"
        style={{
          width: stickSize,
          height: stickSize,
          backgroundColor: stickColor,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          transition: active ? 'none' : 'transform 0.1s ease-out',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};