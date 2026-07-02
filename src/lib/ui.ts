/**
 * UI helpers — color maps, formatters, level titles.
 */
import { LucideIcon } from "lucide-react";
import {
  Footprints, Flame, Brain, Target, Layers, CalendarDays, Zap,
  TrendingUp, GraduationCap, FileText, Award, BookOpen, Sparkles,
  Trophy, Star, Medal, Crown, Rocket, Shield, Lightbulb,
} from "lucide-react";

export const COURSE_COLORS: Record<string, { bg: string; text: string; ring: string; gradient: string; dot: string }> = {
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20", gradient: "from-violet-600 to-fuchsia-600", dot: "bg-violet-500" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20", gradient: "from-emerald-600 to-teal-600", dot: "bg-emerald-500" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20", gradient: "from-amber-500 to-orange-500", dot: "bg-amber-500" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/20", gradient: "from-rose-500 to-pink-500", dot: "bg-rose-500" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/20", gradient: "from-cyan-500 to-blue-500", dot: "bg-cyan-500" },
};

export function courseColor(c: string) {
  return COURSE_COLORS[c] ?? COURSE_COLORS.violet;
}

export const SOURCE_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  pdf: { label: "PDF", color: "text-rose-600 dark:text-rose-400", icon: "FileText" },
  docx: { label: "DOCX", color: "text-cyan-600 dark:text-cyan-400", icon: "FileText" },
  pptx: { label: "PPTX", color: "text-amber-600 dark:text-amber-400", icon: "FileText" },
  txt: { label: "TXT", color: "text-muted-foreground", icon: "FileText" },
  md: { label: "MD", color: "text-violet-600 dark:text-violet-400", icon: "FileText" },
};

export const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-slate-400 to-slate-300",
  gold: "from-amber-400 to-yellow-300",
  platinum: "from-cyan-300 to-violet-300",
};

export const TIER_RING: Record<string, string> = {
  bronze: "ring-amber-600/30",
  silver: "ring-slate-400/30",
  gold: "ring-amber-400/40",
  platinum: "ring-violet-400/40",
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  adaptive: "Adaptive",
};

const ICON_MAP: Record<string, LucideIcon> = {
  Footprints, Flame, Brain, Target, Layers, CalendarDays, Zap,
  TrendingUp, GraduationCap, FileText, Award, BookOpen, Sparkles,
  Trophy, Star, Medal, Crown, Rocket, Shield, Lightbulb,
};

export function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? Sparkles;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString();
}

export const LEVEL_TITLES = [
  "Novice", "Apprentice", "Learner", "Scholar", "Adept", "Expert",
  "Master", "Sage", "Mentor", "Virtuoso", "Illuminated", "Luminary",
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? "Learner";
}
