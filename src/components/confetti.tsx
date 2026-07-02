"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CONFETTI_COLORS = [
  "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444",
];

/**
 * Confetti celebration overlay. Renders falling confetti pieces.
 * Pass a unique `burstId` to trigger a new burst (changes re-generate pieces).
 */
export function Confetti({ show, burstId = 0 }: { show: boolean; burstId?: number }) {
  // Generate pieces based on burstId so they're stable per burst
  const pieces = useMemo(() => {
    if (!show) return [];
    return Array.from({ length: 40 }, (_, i) => ({
      id: `${burstId}-${i}`,
      x: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 0.5,
    }));
  }, [show, burstId]);

  return (
    <AnimatePresence>
      {show && pieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{ y: -20, opacity: 1, rotate: 0 }}
              animate={{ y: "100vh", opacity: 0, rotate: 720 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, delay: piece.delay, ease: "easeOut" }}
              className="absolute w-2 h-2 rounded-sm"
              style={{ backgroundColor: piece.color, left: `${piece.x}%` }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
