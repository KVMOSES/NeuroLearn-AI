"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles, Zap, Flame, Trophy, CheckCircle2, Star } from "lucide-react";

export type CelebrationType = "level-up" | "streak" | "lesson-complete" | "achievement" | "mission-complete";

interface CelebrationProps {
  type: CelebrationType;
  title: string;
  subtitle?: string;
  icon?: string;
  show: boolean;
  onComplete: () => void;
}

const CELEBRATION_CONFIG: Record<CelebrationType, { gradient: string; icon: any; sound?: string }> = {
  "level-up": { gradient: "from-violet-500 via-fuchsia-500 to-amber-500", icon: Zap },
  "streak": { gradient: "from-amber-500 via-orange-500 to-rose-500", icon: Flame },
  "lesson-complete": { gradient: "from-emerald-500 via-teal-500 to-cyan-500", icon: CheckCircle2 },
  "achievement": { gradient: "from-amber-400 via-yellow-400 to-orange-400", icon: Trophy },
  "mission-complete": { gradient: "from-violet-500 via-primary to-fuchsia-500", icon: Star },
};

/**
 * Full-screen cinematic celebration overlay.
 * Shows animated gradient, confetti, icon burst, title, and auto-dismisses.
 */
export function Celebration({ type, title, subtitle, icon, show, onComplete }: CelebrationProps) {
  const config = CELEBRATION_CONFIG[type];
  const Icon = config.icon;

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (show) {
      const t = setTimeout(onComplete, 3000);
      return () => clearTimeout(t);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop blur */}
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

          {/* Confetti pieces */}
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: 0,
                y: 0,
                opacity: 1,
                rotate: 0,
                scale: 1,
              }}
              animate={{
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 600,
                opacity: 0,
                rotate: Math.random() * 720,
                scale: 0.5,
              }}
              transition={{ duration: 2, ease: "easeOut", delay: Math.random() * 0.3 }}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                backgroundColor: ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"][i % 5],
              }}
            />
          ))}

          {/* Central content */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="relative z-10 text-center"
          >
            {/* Icon burst */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.2 }}
              className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${config.gradient} flex items-center justify-center mx-auto mb-5 shadow-2xl`}
            >
              {icon ? (
                <span className="text-5xl">{icon}</span>
              ) : (
                <Icon className="w-12 h-12 text-white" />
              )}
            </motion.div>

            {/* Radiating rings */}
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-3xl bg-gradient-to-br ${config.gradient}`}
            />

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-bold tracking-tight"
            >
              {title}
            </motion.h2>

            {/* Subtitle */}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground mt-2"
              >
                {subtitle}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Floating XP indicator that appears and floats up.
 */
export function XPFloater({ amount, show, onComplete }: { amount: number; show: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onComplete, 1200);
      return () => clearTimeout(t);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1, y: 0, scale: 0.8 }}
          animate={{ opacity: 0, y: -50, scale: 1.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] pointer-events-none"
        >
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg">
            <Zap className="w-4 h-4" />
            <span className="text-lg font-bold">+{amount} XP</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Cinematic loading sequence for document analysis.
 * Shows progressive steps like "Reading your document..." → "Understanding concepts..." etc.
 */
export function CinematicProgress({ steps, currentStep, show }: {
  steps: string[];
  currentStep: number;
  show: boolean;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-lg"
        >
          <div className="text-center max-w-sm mx-auto px-6">
            {/* Pulsing orb */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 mx-auto mb-6 flex items-center justify-center shadow-2xl"
            >
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </motion.div>

            {/* Steps */}
            <div className="space-y-2 text-left">
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2.5"
                >
                  {i < currentStep ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : i === currentStep ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full shrink-0"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
                  )}
                  <span className={`text-sm ${i === currentStep ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {step}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
