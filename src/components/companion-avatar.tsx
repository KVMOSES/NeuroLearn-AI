"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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
        {/* Prefer the project's chatbot image when available, fall back to the emoji icon */}
        <AvatarImage icon={icon} />
        {/* Subtle shine */}
        <div className="absolute top-1 left-1 w-1/3 h-1/3 rounded-full bg-white/20 blur-[2px]" />
      </motion.div>
    </div>
  );
}

function AvatarImage({ icon }: { icon: string }) {
  const CHATBOT_SRC = "/images/chatbot.png";
  const [imgOk, setImgOk] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const img = new Image();
    img.src = CHATBOT_SRC;
    img.onload = () => { if (mounted) setImgOk(true); };
    img.onerror = () => { if (mounted) setImgOk(false); };
    return () => { mounted = false; };
  }, []);

  if (imgOk === null) {
    // still checking — render the fallback icon to avoid layout shift
    return <span className="drop-shadow-sm">{icon}</span>;
  }

  if (imgOk === false) {
    return <span className="drop-shadow-sm">{icon}</span>;
  }

  return (
    <img src={CHATBOT_SRC} alt="chatbot" className="w-full h-full object-cover rounded-full drop-shadow-sm" />
  );
}
