"use client";

import { motion } from "framer-motion";

interface CompanionAvatarProps {
  icon: string;
  gradient: string;
  size?: "sm" | "md" | "lg" | "xl";
  state?: "idle" | "wave" | "celebrate" | "think";
  className?: string;
}

const SIZES = {
  sm: "w-8 h-8 text-base",
  md: "w-10 h-10 text-lg",
  lg: "w-14 h-14 text-2xl",
  xl: "w-20 h-20 text-4xl",
};

/**
 * Animated AI Companion avatar.
 * Shows idle floating, wave greeting, celebrate bounce, or think state.
 */
export function CompanionAvatar({
  icon,
  gradient,
  size = "md",
  state = "idle",
  className = "",
}: CompanionAvatarProps) {
  // Derive the display state from props directly
  const stateClass =
    state === "idle" ? "companion-idle" :
    state === "wave" ? "companion-wave" :
    state === "celebrate" ? "companion-celebrate" :
    "";

  return (
    <div className={`relative ${SIZES[size]} ${className}`}>
      {/* Glow ring */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-20 blur-md`} />
      {/* Avatar */}
      <motion.div
        className={`relative w-full h-full rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-soft-lg ${stateClass}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <span className="drop-shadow-sm">{icon}</span>
        {/* Subtle shine */}
        <div className="absolute top-1 left-1 w-1/3 h-1/3 rounded-full bg-white/20 blur-[2px]" />
      </motion.div>
    </div>
  );
}
