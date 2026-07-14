"use client";

import { motion } from "framer-motion";
import { COMPANION_AVATAR_SRC } from "@/lib/companion-assets";
import { useState } from "react";

interface CompanionAvatarProps {
  icon: string;
  gradient: string;
  size?: "sm" | "md" | "lg" | "xl";
  state?: "idle" | "wave" | "celebrate" | "think";
  className?: string;
}

const SIZES = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
};

const FALLBACK_TEXT = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl",
};

/**
 * Animated AI Companion avatar.
 * Renders the shared 3D mascot with blue/purple ambient glow,
 * circular crop, and idle / wave / celebrate states.
 */
export function CompanionAvatar({
  icon,
  gradient,
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
      {/* Ambient glow — sits outside the image, never behind the PNG */}
      <div className="absolute -inset-[18%] rounded-full companion-avatar-glow pointer-events-none" aria-hidden />

      {/* Circular container — fully transparent; only clips shape */}
      <motion.div
        className={`relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-transparent ${stateClass}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <CompanionAvatarImage icon={icon} size={size} gradient={gradient} />
      </motion.div>
    </div>
  );
}

function CompanionAvatarImage({
  icon,
  size,
  gradient,
}: {
  icon: string;
  size: keyof typeof SIZES;
  gradient: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
      >
        <span className={`${FALLBACK_TEXT[size]} drop-shadow-sm`}>{icon}</span>
      </div>
    );
  }

  return (
    <img
      src={COMPANION_AVATAR_SRC}
      alt="AI Companion"
      className="w-full h-full object-contain object-center select-none bg-transparent"
      style={{ background: "transparent" }}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
