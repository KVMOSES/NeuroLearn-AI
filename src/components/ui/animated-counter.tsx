"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  /** Target number to count up to */
  value: number;
  /** Duration in ms (default 800) */
  duration?: number;
  /** Number of decimal places (default 0) */
  decimals?: number;
  className?: string;
}

/**
 * Smoothly counts from 0 to `value` using requestAnimationFrame.
 * Automatically re-animates when `value` changes.
 */
export function AnimatedCounter({ value, duration = 800, decimals = 0, className }: AnimatedCounterProps) {
  const [display, setDisplay] = useState("0");
  const raf = useRef<number>(0);
  const start = useRef<number>(0);
  const from = useRef<number>(0);

  useEffect(() => {
    const to = value;
    const fromVal = from.current;
    const dur = duration;
    start.current = performance.now();

    function tick(now: number) {
      const elapsed = now - start.current;
      const progress = Math.min(elapsed / dur, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromVal + (to - fromVal) * eased;
      setDisplay(current.toFixed(decimals));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        from.current = to;
      }
    }

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration, decimals]);

  return <span className={className}>{display}</span>;
}
