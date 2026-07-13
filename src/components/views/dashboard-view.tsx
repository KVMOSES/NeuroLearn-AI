"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Home, GraduationCap, Bot, Sparkles, BarChart3, Layers, HelpCircle,
  Timer, LineChart, Network, School, Gamepad2, Search, Sun, Bell,
  ChevronDown, ChevronLeft, ChevronRight, Flame, Zap, Shield,
  Target, Clock, Plus, Calendar, MoreHorizontal, TrendingUp,
  ArrowRight, Pencil, BookOpen, CheckCircle2, AlertCircle,
  Brain, Lightbulb, FileText, Award, Coffee,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api-client";
import type { MissionDTO, MaterialSummary, LearnerProfileDTO, JourneyDTO } from "@/lib/types";
import { levelTitle, relativeTime } from "@/lib/ui";
import { motion, AnimatePresence } from "framer-motion";
import { LoadingState } from "@/components/empty-states";
import { DashboardSkeleton } from "@/components/skeletons";
import { CompanionAvatar } from "@/components/companion-avatar";
import { useAtmosphere } from "@/lib/atmosphere";
import { Celebration, XPFloater } from "@/components/celebration";

/* ---------------------------------------------------------------------- */
/* Companion config                                                       */
/* ---------------------------------------------------------------------- */
const COMPANIONS_MAP: Record<string, { icon: string; gradient: string; name: string; greeting: string }> = {
  nova: { icon: "🌟", gradient: "from-amber-500 to-orange-500", name: "Nova", greeting: "Hey there! Ready to learn something amazing?" },
  atlas: { icon: "🧭", gradient: "from-blue-500 to-cyan-500", name: "Atlas", greeting: "Good to see you. Let's build real understanding today." },
  sage: { icon: "🍃", gradient: "from-emerald-500 to-teal-500", name: "Sage", greeting: "Welcome back. Take a breath — let's learn at your pace." },
  spark: { icon: "⚡", gradient: "from-rose-500 to-pink-500", name: "Spark", greeting: "Let's GO! Time to level up your knowledge!" },
};

/* ---------------------------------------------------------------------- */
/* Sparkline mini-chart                                                   */
/* ---------------------------------------------------------------------- */
function Sparkline({ color, values, id }: { color: string; values: number[]; id: string }) {
  const w = 100, h = 36;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - min) / range) * h,
  ]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const fill = `${line} L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Flask illustration for hero                                            */
/* ---------------------------------------------------------------------- */
function FlaskIllustration() {
  return (
    <svg width="170" height="170" viewBox="0 0 170 170" fill="none" className="shrink-0 relative z-10">
      <circle cx="138" cy="34" r="6" fill="#F0ABFC" opacity="0.6" />
      <circle cx="148" cy="80" r="4" fill="#C4B5FD" opacity="0.6" />
      <circle cx="24" cy="56" r="5" fill="#93C5FD" opacity="0.55" />
      <circle cx="18" cy="100" r="3" fill="#F9A8D4" opacity="0.6" />
      <rect x="68" y="18" width="34" height="12" rx="4" fill="#EDE9FE" />
      <path
        d="M72 30 H98 V62 L124 118 A12 12 0 0 1 113 135 H57 A12 12 0 0 1 46 118 L72 62 Z"
        fill="white"
        stroke="#E9D5FF"
        strokeWidth="2.5"
      />
      <path
        d="M57 96 L46 118 A12 12 0 0 0 57 135 H113 A12 12 0 0 0 124 118 L113 96 Z"
        fill="url(#flaskLiquid)"
      />
      <circle cx="85" cy="112" r="3" fill="white" opacity="0.6" />
      <circle cx="95" cy="122" r="2" fill="white" opacity="0.5" />
      <defs>
        <linearGradient id="flaskLiquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F9A8D4" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Blob mascot for mission footer                                         */
/* ---------------------------------------------------------------------- */
function BlobMascot() {
  return (
    <svg width="52" height="52" viewBox="0 0 56 56" className="shrink-0">
      <ellipse cx="28" cy="30" rx="21" ry="19" fill="#F9A8D4" />
      <ellipse cx="28" cy="30" rx="21" ry="19" fill="url(#blobShade)" opacity="0.5" />
      <circle cx="20.5" cy="27" r="2.6" fill="#831843" />
      <circle cx="34.5" cy="27" r="2.6" fill="#831843" />
      <path d="M20 36 Q28 42 36 36" stroke="#831843" strokeWidth="2" fill="none" strokeLinecap="round" />
      <defs>
        <linearGradient id="blobShade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBCFE8" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Nova avatar for AI companion card                                      */
/* ---------------------------------------------------------------------- */
function NovaAvatar() {
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-sky-300 opacity-30 blur-2xl animate-pulse" />
      <div
        className="relative w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: 'radial-gradient(circle at 32% 30%, #EDE9FE, #DBEAFE)' }}
      >
        <CompanionAvatar icon="🌟" gradient="from-amber-500 to-orange-500" size="xl" state="idle" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Stat card                                                              */
/* ---------------------------------------------------------------------- */
function StatCard({ glow, label, value, unit, sub, chartColor, trend }: {
  glow: string; label: string; value: string; unit?: string; sub: string;
  chartColor: string; trend: number[];
}) {
  return (
    <div className={`glass-card rounded-2xl p-5 ${glow}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-end gap-1 mb-1">
        <span className="text-3xl font-black text-foreground">{value}</span>
        {unit && <span className="text-xs text-muted-foreground mb-1">{unit}</span>}
      </div>
      <p className="text-xs text-muted-foreground mb-2">{sub}</p>
      <Sparkline color={chartColor} values={trend} id={`spark-${label.replace(/\s/g, '')}`} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Badges card                                                            */
/* ---------------------------------------------------------------------- */
function BadgesCard({ count }: { count: number }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
          <Shield size={14} className="text-orange-500" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Badges</span>
      </div>
      <div className="flex items-end gap-1 mb-1">
        <span className="text-3xl font-black text-foreground">{count}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Unlocked</p>
      <div className="flex gap-1 text-lg">
        {count > 0 ? "🏆⭐🔥" : "—"}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Mission item                                                           */
/* ---------------------------------------------------------------------- */
function MissionItem({ task, index }: { task: any; index: number }) {
  const accentColors = ["pink", "orange", "blue"];
  const accent = accentColors[index % 3];
  return (
    <button className="mission-row w-full flex items-center gap-4 p-3 rounded-2xl text-left group">
      <div className="w-11 h-11 flex items-center justify-center shrink-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          task.completed ? "bg-emerald-500" : task.type === "review" ? "bg-amber-500/80" : task.type === "analyze" ? "bg-cyan-500/80" : "bg-primary/15"
        }`}>
          {task.completed ? <CheckCircle2 className="w-5 h-5 text-white" />
            : task.type === "review" ? <Coffee className="w-5 h-5 text-white" />
            : task.type === "analyze" ? <Sparkles className="w-5 h-5 text-white" />
            : <BookOpen className="w-5 h-5 text-primary" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold text-foreground ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
      </div>
      {task.estimatedMinutes > 0 && <span className="text-xs text-muted-foreground shrink-0">{task.estimatedMinutes}m</span>}
      {!task.completed && <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Study Calendar                                                         */
/* ---------------------------------------------------------------------- */
const CALENDAR_DAYS = [
  { d: 31, muted: true }, { d: 1 }, { d: 2 }, { d: 3 }, { d: 4 }, { d: 5 }, { d: 6 },
  { d: 7 }, { d: 8 }, { d: 9 }, { d: 10 }, { d: 11 }, { d: 12 }, { d: 13 },
  { d: 14 }, { d: 15 }, { d: 16 }, { d: 17 }, { d: 18 }, { d: 19 }, { d: 20 },
  { d: 21 }, { d: 22 }, { d: 23 }, { d: 24 }, { d: 25 }, { d: 26 }, { d: 27 },
  { d: 28 }, { d: 29 }, { d: 30 }, { d: 1, muted: true }, { d: 2, muted: true },
  { d: 3, muted: true }, { d: 4, muted: true },
];

function StudyCalendar() {
  const [selected, setSelected] = useState(8);
  const selectedInfo = CALENDAR_DAYS[selected];
  const label = selectedInfo?.muted ? `${selectedInfo.d} — other month` : `${selectedInfo?.d} June 2026`;
  const message = selected === 8 ? 'You have tasks planned today.' : 'No tasks planned for this day yet.';

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-purple-400" />
          <h3 className="font-semibold text-foreground text-sm">Study Calendar</h3>
        </div>
        <button className="text-muted-foreground/40 hover:text-muted-foreground">
          <MoreHorizontal size={16} />
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <button className="text-muted-foreground/40 hover:text-muted-foreground">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-semibold text-foreground/60">June 2026</span>
        <button className="text-muted-foreground/40 hover:text-muted-foreground">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="text-xs font-medium text-muted-foreground/30">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {CALENDAR_DAYS.map((day, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`cal-day w-7 h-7 mx-auto rounded-full text-xs flex items-center justify-center transition-all ${
              i === selected
                ? 'bg-primary text-primary-foreground font-semibold shadow-md'
                : day.muted
                ? 'text-muted-foreground/30'
                : 'text-foreground/60'
            }`}
          >
            {day.d}
          </button>
        ))}
      </div>
      <div className="flex items-start gap-2 mt-4 pt-4 border-t border-border">
        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Learning Insights chart                                                */
/* ---------------------------------------------------------------------- */
function LearningInsights() {
  const values = [10, 14, 12, 18, 16, 24, 22, 30, 38];
  const w = 260, h = 90;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - min) / range) * (h - 10) - 5,
  ]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const fill = `${line} L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`;
  const last = pts[pts.length - 1];

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-green-500" />
          <h3 className="font-semibold text-foreground text-sm">Learning Insights</h3>
        </div>
        <button className="text-muted-foreground/40 hover:text-muted-foreground">
          <MoreHorizontal size={16} />
        </button>
      </div>
      <p className="text-sm font-semibold text-foreground leading-snug">Your confidence is growing steadily.</p>
      <p className="text-xs text-muted-foreground mt-1 mb-3">You're ready for harder challenges!</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="insightsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="insightsStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#insightsFill)" />
        <path d={line} fill="none" stroke="url(#insightsStroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4" fill="#F97316" stroke="white" strokeWidth="2" />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Activity row for timeline                                              */
/* ---------------------------------------------------------------------- */
const EVENT_ICONS: Record<string, any> = {
  BookOpen, Award, Target, Brain, FileText, Zap,
};
const EVENT_COLORS: Record<string, string> = {
  lesson: "bg-primary/10 text-primary",
  quiz: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  diagnostic: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  document: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  xp: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function ActivityRow({ event, isLast }: { event: any; isLast: boolean }) {
  const Icon = EVENT_ICONS[event.icon] ?? BookOpen;
  const colorClass = EVENT_COLORS[event.type] ?? EVENT_COLORS.lesson;
  return (
    <div className="flex gap-2.5 relative">
      {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <p className="text-xs font-medium leading-tight text-foreground">{event.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{event.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-muted-foreground">{relativeTime(event.timestamp)}</span>
          {event.xp && event.xp > 0 && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 gap-0.5">
              <Zap className="w-2 h-2 text-amber-500" /> +{event.xp}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* MAIN DASHBOARD VIEW                                                    */
/* ====================================================================== */
export function DashboardView() {
  const { me, setView } = useAppStore();
  const [mission, setMission] = useState<MissionDTO | null>(null);
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [profile, setProfile] = useState<LearnerProfileDTO | null>(null);
  const [journey, setJourney] = useState<JourneyDTO | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [companion, setCompanion] = useState<string>("nova");
  const [loading, setLoading] = useState(true);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const atmosphere = useAtmosphere();

  const load = useCallback(async () => {
    try {
      const [m, mat, p, j, comp, ins] = await Promise.all([
        api.get<MissionDTO>("/api/teaching/mission"),
        api.get<{ materials: MaterialSummary[] }>("/api/teaching/materials"),
        api.get<{ profile: LearnerProfileDTO | null }>("/api/teaching/profile"),
        api.get<JourneyDTO>("/api/teaching/journey"),
        api.get<{ companions: any[]; currentCompanion: string }>("/api/teaching/companion"),
        api.get<{ insights: string[] }>("/api/teaching/insights").catch(() => ({ insights: [] })),
      ]);
      setMission(m);
      setMaterials(mat.materials);
      setProfile(p.profile);
      setJourney(j);
      setCompanion(comp.currentCompanion);
      setInsights(ins.insights || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Streak celebration
  useEffect(() => {
    if (mission && mission.streak.current >= 3) {
      const key = `nl-streak-celebrated-${mission.streak.current}-${new Date().toDateString()}`;
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setTimeout(() => setShowStreakCelebration(true), 1500);
      }
    }
  }, [mission]);

  if (!me) return null;
  if (loading || !mission) return <DashboardSkeleton />;

  const inProgressMaterials = materials.filter((m) => m.analyzed && m.planStatus === "active").slice(0, 3);
  const unanalyzed = materials.filter((m) => !m.analyzed);
  const firstName = me.user.name.split(" ")[0];
  const comp = COMPANIONS_MAP[companion] ?? COMPANIONS_MAP.nova;

  // Mood-based companion greetings
  const moodGreetings: Record<string, string> = {
    morning: comp.greeting,
    afternoon: comp.greeting,
    evening: `${comp.name === "Nova" ? "Evening study session? Love it!" : comp.name === "Sage" ? "A calm evening to learn. Perfect." : "Let's make this evening productive."}`,
    night: `${comp.name === "Sage" ? "Late night studying? Take it slow." : comp.name === "Spark" ? "Night owl, I see you! Let's go!" : "Burning the midnight oil. I'm here."}`,
  };
  const companionGreeting = moodGreetings[atmosphere.timeOfDay] ?? comp.greeting;

  // Stats data from real API
  const stats = [
    {
      glow: "glow-pink",
      label: "Study Streak",
      value: String(mission.streak.current),
      unit: "days",
      sub: mission.streak.current > 0 ? "Keep it going!" : "Start your streak today!",
      chartColor: "#EC4899",
      trend: [30, 27, 25, 26, 18, 13, Math.max(mission.streak.current, 6)],
    },
    {
      glow: "glow-blue",
      label: "XP Today",
      value: String(mission.xpEarnedToday),
      unit: "XP",
      sub: `${mission.xpTarget - mission.xpEarnedToday > 0 ? `${mission.xpTarget - mission.xpEarnedToday} XP to go` : "Daily goal met! 🎉"}`,
      chartColor: "#3B82F6",
      trend: [32, 30, 24, 22, 16, 12, Math.max(mission.xpEarnedToday, 4)],
    },
    {
      glow: "glow-green",
      label: "Level",
      value: String(mission.level),
      sub: levelTitle(mission.level),
      chartColor: "#22C55E",
      trend: [34, 30, 26, 20, 13, 9, Math.max(mission.level * 5, 5)],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto page-reveal space-y-6 pb-8">
      {/* Streak celebration */}
      <Celebration
        type="streak"
        title={`${mission.streak.current} Day Streak! 🔥`}
        subtitle="You're on fire. Keep it going!"
        icon="🔥"
        show={showStreakCelebration}
        onComplete={() => setShowStreakCelebration(false)}
      />

      {/* ===== TOP HEADER ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {atmosphere.icon} {atmosphere.greeting}, <span className="font-semibold text-foreground">{firstName}</span>
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-1 tracking-tight">
              Ready to learn something{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-pink-500 via-orange-400 to-sky-400 bg-clip-text text-transparent">
                  amazing
                </span>
                <svg className="absolute -bottom-1.5 left-0 w-full h-2.5" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="amazingUnderline" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#EC4899" />
                      <stop offset="50%" stopColor="#FB923C" />
                      <stop offset="100%" stopColor="#38BDF8" />
                    </linearGradient>
                  </defs>
                  <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="url(#amazingUnderline)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("tutor")}
              className="hidden lg:flex items-center gap-2 rounded-xl px-3.5 py-2.5 shadow-sm glass-card text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bot size={15} className="shrink-0" />
              <span className="flex-1 truncate">Chat with {comp.name}</span>
            </button>
            <button className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 hover:scale-105 transition-all shrink-0">
              <Sun size={17} />
            </button>
            <button className="relative w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground glass-card hover:bg-white/80 transition-colors shrink-0">
              <Bell size={17} />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center border-2 border-background">
                3
              </span>
            </button>
            <div className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 glass-card shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                {me.user.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-foreground leading-tight">{me.user.name}</p>
                <p className="text-xs text-muted-foreground leading-tight">Lvl {mission.level}</p>
              </div>
              <ChevronDown size={13} className="text-muted-foreground" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===== HERO CARD ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border border-primary/10"
      >
        <div className="absolute inset-0 gradient-mesh" />
        <div className={`orb w-48 h-48 -top-12 -right-12 bg-gradient-to-br ${comp.gradient}`} style={{ animationDelay: "0s" }} />
        <div className={`orb w-32 h-32 -bottom-8 -left-8 bg-gradient-to-br ${comp.gradient}`} style={{ animationDelay: "5s", opacity: 0.15 }} />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="max-w-md">
              <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-2xl mb-4">
                🧪
              </div>
              <p className="text-xs font-semibold text-pink-500 underline underline-offset-4 decoration-pink-300 mb-2">
                Continue your journey
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-4">
                {mission.taskCount > 0 ? "Master Your Subjects" : "All caught up 🎉"}
                <br />
                Step by Step
              </h2>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {mission.xpProgress}% of daily goal
              </p>
              <div className="w-64 max-w-full h-2 rounded-full overflow-hidden mb-5 bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${mission.xpProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-pink-500 to-orange-400 rounded-full"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setView("learn")}
                  className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-orange-400 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-lg shadow-pink-200 hover:shadow-xl hover:scale-105 transition-all"
                >
                  Continue Learning <ArrowRight size={15} />
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{mission.streak.current} day streak</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{mission.totalXP.toLocaleString()} XP</span>
                </div>
              </div>
            </div>
            <div className="hidden md:block mx-auto relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-purple-300 opacity-40 blur-2xl animate-pulse" />
              </div>
              <FlaskIllustration />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===== STATS ROW ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
        <BadgesCard count={me.gamification.achievements.length} />
      </motion.div>

      {/* ===== MAIN CONTENT GRID ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column — Mission + Continue Learning */}
        <div className="xl:col-span-2 space-y-6">
          {/* ===== TODAY'S MISSION ===== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Today's Mission</h2>
              {mission.estimatedMinutes > 0 && (
                <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> {mission.estimatedMinutes} min
                </span>
              )}
            </div>

            <div className="glass-card rounded-2xl p-5 sm:p-6">
              {mission.taskCount > 0 ? (
                <>
                  <div className="space-y-1">
                    {mission.tasks.slice(0, 3).map((task, i) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        onClick={() => setView("learn")}
                      >
                        <MissionItem task={task} index={i} />
                      </motion.div>
                    ))}
                  </div>

                  {/* XP progress bar */}
                  <div className="px-1 pt-4">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Daily XP</span>
                      <span className="font-medium text-foreground">{mission.xpEarnedToday} / {mission.xpTarget}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${mission.xpProgress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-medium text-foreground">You're all caught up!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Great work. Come back tomorrow for new missions.</p>
                </div>
              )}

              {/* Streak at risk warning */}
              {mission.streak.atRisk && mission.streak.current > 0 && (
                <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">Your {mission.streak.current}-day streak needs attention — complete one task today.</p>
                </div>
              )}

              {/* Mission footer */}
              <div
                className="mt-4 relative overflow-hidden rounded-2xl p-5 flex items-center justify-between gap-4"
                style={{ background: 'linear-gradient(120deg, #FDF2F8, #F3E8FF)' }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Sparkles size={16} className="text-purple-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">
                      {inProgressMaterials.length > 0
                        ? `You're just getting started with "${inProgressMaterials[0].title}".`
                        : "Upload your first document to get started."}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">The first lessons are the most important.</p>
                  </div>
                </div>
                <BlobMascot />
              </div>
            </div>
          </motion.div>

          {/* ===== CONTEXTUAL RECOMMENDATION ===== */}
          {(() => {
            const recommendations: string[] = [];
            if (mission.streak.current >= 3) {
              recommendations.push(`You've studied consistently for ${mission.streak.current} days. Keep the momentum going!`);
            }
            if (mission.xpEarnedToday > 0 && mission.xpEarnedToday < mission.xpTarget) {
              recommendations.push(`You're ${mission.xpTarget - mission.xpEarnedToday} XP away from today's goal. One quick lesson will get you there.`);
            }
            if (unanalyzed.length > 0) {
              recommendations.push(`You have ${unanalyzed.length} document${unanalyzed.length > 1 ? "s" : ""} waiting to be analyzed. Let's turn them into lessons.`);
            }
            if (inProgressMaterials.length > 0 && inProgressMaterials[0].planProgress < 50) {
              recommendations.push(`You're just getting started with "${inProgressMaterials[0].title}". The first lessons are the most important.`);
            }
            if (mission.streak.atRisk && mission.streak.current > 0) {
              recommendations.push(`Your ${mission.streak.current}-day streak needs one more activity today. Don't break the chain!`);
            }
            if (recommendations.length === 0 && mission.taskCount === 0) {
              recommendations.push("Everything's done for today. Great work — come back tomorrow for new missions.");
            }
            return recommendations.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-primary/[0.04] border border-primary/10"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">{recommendations[0]}</p>
              </motion.div>
            ) : null;
          })()}

          {/* ===== AI INSIGHTS ===== */}
          {insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex items-center gap-1.5 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-foreground">Learning Insights</h2>
              </div>
              <div className="space-y-1.5">
                {insights.slice(0, 3).map((insight, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    className="glass-card rounded-xl p-3 border-l-2 border-amber-500/30"
                  >
                    <p className="text-xs leading-relaxed text-foreground/80">{insight}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ===== CONTINUE LEARNING ===== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {inProgressMaterials.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">Continue Learning</h2>
                </div>
                <div className="space-y-2">
                  {inProgressMaterials.map((m, i) => (
                    <motion.button
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      onClick={() => setView("learn", { materialId: m.id })}
                      className="w-full text-left group press"
                    >
                      <Card className="p-3 hover:shadow-soft transition-shadow flex items-center gap-3 glass-card">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors text-foreground">{m.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full" style={{ width: `${m.planProgress}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">{m.planProgress}%</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </Card>
                    </motion.button>
                  ))}
                </div>
              </>
            ) : materials.length === 0 ? (
              /* First-time welcome */
              <Card className="p-8 text-center border-dashed relative overflow-hidden glass-card">
                <div className="absolute inset-0 gradient-mesh opacity-30" />
                <div className="relative z-10">
                  <CompanionAvatar icon={comp.icon} gradient={comp.gradient} size="xl" state="wave" className="mx-auto mb-4" />
                  <h3 className="font-bold text-lg text-foreground">Welcome to your study space</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    Upload your first document and I'll analyze it, assess your understanding, and guide you through personalized lessons.
                  </p>
                  <div className="flex gap-2 justify-center mt-5">
                    <Button onClick={() => setView("learn")} className="bg-primary text-primary-foreground press">
                      <Plus className="w-4 h-4 mr-1" /> Upload material
                    </Button>
                    <Button variant="outline" onClick={() => setView("tutor")} className="press">
                      <Bot className="w-4 h-4 mr-1" /> Talk to {comp.name}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}
          </motion.div>

          {/* ===== UNANALYZED NUDGE ===== */}
          {unanalyzed.length > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              onClick={() => setView("learn")}
              className="w-full press"
            >
              <Card className="p-3.5 border-amber-500/20 bg-amber-500/[0.03] glass-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-xs flex-1 text-foreground/80"><span className="font-medium">{unanalyzed.length} {unanalyzed.length === 1 ? "document" : "documents"}</span> ready to analyze</p>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </Card>
            </motion.button>
          )}

          {/* ===== RECENT ACTIVITY ===== */}
          {journey && journey.timeline.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground">Recent Activity</h2>
                {journey.summary.activeDays > 0 && (
                  <span className="text-[10px] text-muted-foreground">{journey.summary.activeDays} active {journey.summary.activeDays === 1 ? "day" : "days"}</span>
                )}
              </div>
              <Card className="p-4 glass-card">
                <div className="space-y-2.5">
                  {journey.timeline.slice(0, 4).map((event, i) => (
                    <ActivityRow key={event.id} event={event} isLast={i === Math.min(3, journey.timeline.length - 1)} />
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* ===== RIGHT SIDEBAR — AI Companion, Calendar, Insights ===== */}
        <div className="space-y-6 hidden xl:block">
          {/* AI Companion */}
          <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-sky-200 blur-3xl opacity-30 pointer-events-none" />
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-pink-400" />
                <h3 className="font-semibold text-foreground text-sm">Your AI Companion</h3>
              </div>
              <button className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80">
                <Plus size={13} />
              </button>
            </div>
            <div className="relative flex flex-col items-center text-center py-1">
              <NovaAvatar />
              <p className="font-semibold text-foreground mt-3">{comp.name}</p>
              <p className="flex items-center gap-1 text-xs text-amber-500 font-medium mt-0.5">
                <Zap size={11} /> Energetic
              </p>
              <p className="text-xs text-muted-foreground mt-3 italic">"{companionGreeting}"</p>
              <button
                onClick={() => setView("tutor")}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-sm font-semibold py-2.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:scale-105 transition-all"
              >
                Chat with {comp.name} <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Study Calendar */}
          <StudyCalendar />

          {/* Learning Insights */}
          <LearningInsights />
        </div>
      </div>
    </div>
  );
}