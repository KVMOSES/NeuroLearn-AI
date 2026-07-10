"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  /** Distance threshold (px) within which the magnetic pull activates */
  distance?: number;
  /** Max pull offset (px) */
  strength?: number;
}

/**
 * Wraps a child element with a subtle magnetic pull toward the cursor.
 * Only active on fine-pointer devices; respects prefers-reduced-motion.
 */
export function Magnetic({ children, className, distance = 80, strength = 6 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15 });
  const springY = useSpring(y, { stiffness: 150, damping: 15 });

  function onMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < distance) {
      const factor = (1 - dist / distance) * strength;
      x.set(dx * factor);
      y.set(dy * factor);
    } else {
      x.set(0);
      y.set(0);
    }
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
