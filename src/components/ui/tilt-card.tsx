"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt angle in degrees */
  maxTilt?: number;
  /** Perspective distance (px) — lower = more dramatic */
  perspective?: number;
}

/**
 * Wraps a card with a subtle 3D tilt that follows the pointer.
 * Only active on fine-pointer devices; CSS hides the effect on touch.
 */
export function TiltCard({ children, className, maxTilt = 6, perspective = 800 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const springX = useSpring(useTransform(mx, [0, 1], [-maxTilt, maxTilt]), { stiffness: 120, damping: 14 });
  const springY = useSpring(useTransform(my, [0, 1], [maxTilt, -maxTilt]), { stiffness: 120, damping: 14 });

  function onMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  }

  function onLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      style={{
        rotateX: springY,
        rotateY: springX,
        transformStyle: "preserve-3d",
        perspective,
      }}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
