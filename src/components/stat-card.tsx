"use client";

import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: { value: number; positive: boolean };
  accent?: "violet" | "emerald" | "amber" | "rose" | "cyan";
  delay?: number;
}

const ACCENTS: Record<string, { bg: string; text: string; glow: string }> = {
  violet: { bg: "bg-primary/10", text: "text-primary", glow: "shadow-primary/10" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-300", glow: "shadow-emerald-500/10" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-300", glow: "shadow-amber-500/10" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-300", glow: "shadow-rose-500/10" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-300", glow: "shadow-cyan-500/10" },
};

export function StatCard({ label, value, icon: Icon, hint, trend, accent = "violet", delay = 0 }: StatCardProps) {
  const a = ACCENTS[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className={cn("p-5 relative overflow-hidden hover:shadow-lg transition-shadow", a.glow)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl lg:text-3xl font-bold mt-1.5 tracking-tight">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
            {trend && (
              <p className={cn("text-xs font-medium mt-1.5", trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}% this week
              </p>
            )}
          </div>
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", a.bg)}>
            <Icon className={cn("w-5 h-5", a.text)} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
