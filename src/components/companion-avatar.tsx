"use client";

import { motion } from "framer-motion";
import { AICompanion } from "@/components/ai-companion";

interface CompanionAvatarProps {
  icon?: string;
  gradient?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  state?: "idle" | "wave" | "celebrate" | "think";
  className?: string;
}

const SIZES = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
  "2xl": "w-[8.5rem] h-[8.5rem]",
};

/**
 * Animated AI Companion avatar.
 * Renders the premium 3D glassmorphism companion with an ambient glow and a
 * gentle floating animation. The mascot itself is the AICompanion SVG.
 */
export function CompanionAvatar({
  size = "md",
  state = "idle",
  className = "",
}: CompanionAvatarProps) {
  const stateClass =
    state === "idle" ? "companion-idle" :
    state === "wave" ? "companion-wave" :
    state === "celebrate" ? "companion-celebrate" :
    "";

  return (
    <div className={`relative ${SIZES[size]} ${className}`}>
      {/* Ambient glow — sits outside the image, never behind the mascot */}
      <div className="absolute -inset-[18%] rounded-full companion-avatar-glow pointer-events-none" aria-hidden />

      {/* Circular container — fully transparent; only clips shape */}
      <motion.div
        className={`relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-transparent ${stateClass}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <AICompanion size={size} />
      </motion.div>
    </div>
  );
}
