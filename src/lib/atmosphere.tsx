"use client";

import { useEffect, useState, useCallback } from "react";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export interface Atmosphere {
  timeOfDay: TimeOfDay;
  greeting: string;
  icon: string;
  // CSS gradient for the background atmosphere
  bgGradient: string;
  // Overlay tint for cards
  cardTint: string;
  // Accent warmth (0 = cool, 1 = warm)
  warmth: number;
  // Whether to show stars/particles
  showStars: boolean;
  // Companion mood
  companionMood: "energetic" | "focused" | "relaxed" | "sleepy";
  // Ambient description for UI
  ambientLabel: string;
}

function getAtmosphere(): Atmosphere {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      timeOfDay: "morning",
      greeting: "Good morning",
      icon: "☀️",
      bgGradient: "radial-gradient(at 20% 0%, oklch(0.95 0.08 80 / 0.15) 0%, transparent 50%), radial-gradient(at 80% 100%, oklch(0.9 0.05 200 / 0.08) 0%, transparent 50%)",
      cardTint: "oklch(0.99 0.005 80)",
      warmth: 0.7,
      showStars: false,
      companionMood: "energetic",
      ambientLabel: "Morning energy",
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      timeOfDay: "afternoon",
      greeting: "Good afternoon",
      icon: "🌤️",
      bgGradient: "radial-gradient(at 30% 0%, oklch(0.92 0.04 220 / 0.08) 0%, transparent 50%), radial-gradient(at 70% 100%, oklch(0.9 0.03 280 / 0.06) 0%, transparent 50%)",
      cardTint: "oklch(0.99 0.002 220)",
      warmth: 0.4,
      showStars: false,
      companionMood: "focused",
      ambientLabel: "Focused afternoon",
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      timeOfDay: "evening",
      greeting: "Good evening",
      icon: "🌆",
      bgGradient: "radial-gradient(at 20% 0%, oklch(0.8 0.06 40 / 0.1) 0%, transparent 50%), radial-gradient(at 80% 100%, oklch(0.7 0.05 300 / 0.08) 0%, transparent 50%)",
      cardTint: "oklch(0.98 0.005 40)",
      warmth: 0.8,
      showStars: false,
      companionMood: "relaxed",
      ambientLabel: "Cozy evening",
    };
  } else {
    return {
      timeOfDay: "night",
      greeting: "Good night",
      icon: "🌙",
      bgGradient: "radial-gradient(at 30% 0%, oklch(0.3 0.04 270 / 0.12) 0%, transparent 50%), radial-gradient(at 70% 100%, oklch(0.25 0.03 240 / 0.1) 0%, transparent 50%)",
      cardTint: "oklch(0.97 0.002 270)",
      warmth: 0.2,
      showStars: true,
      companionMood: "sleepy",
      ambientLabel: "Quiet night",
    };
  }
}

/**
 * Hook that provides the current time-of-day atmosphere.
 * Updates automatically when the time period changes.
 */
export function useAtmosphere(): Atmosphere {
  const [atmosphere, setAtmosphere] = useState<Atmosphere>(() => getAtmosphere());

  useEffect(() => {
    // Check every 5 minutes for time changes
    const interval = setInterval(() => {
      const newAtm = getAtmosphere();
      setAtmosphere((prev) => (prev.timeOfDay !== newAtm.timeOfDay ? newAtm : prev));
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return atmosphere;
}

/**
 * Floating star particles for night mode.
 */
export function StarField({ count = 20 }: { count?: number }) {
  const stars = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    delay: Math.random() * 5,
    duration: 3 + Math.random() * 4,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white/30"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
