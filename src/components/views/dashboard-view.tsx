"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Flame, ChevronRight, BookOpen, Zap, Bot, Plus,
  FileText, CheckCircle2, Sparkles, AlertCircle,
  Clock, Target, Brain, Rocket, Lightbulb, Coffee, Award,
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

const COMPANIONS_MAP: Record<string, { icon: string; gradient: string; name: string; greeting: string }> = {
  nova: { icon: "🌟", gradient: "from-amber-500 to-orange-500", name: "Nova", greeting: "Hey there! Ready to learn something amazing?" },
  atlas: { icon: "🧭", gradient: "from-blue-500 to-cyan-500", name: "Atlas", greeting: "Good to see you. Let's build real understanding today." },
  sage: { icon: "🍃", gradient: "from-emerald-500 to-teal-500", name: "Sage", greeting: "Welcome back. Take a breath — let's learn at your pace." },
  spark: { icon: "⚡", gradient: "from-rose-500 to-pink-500", name: "Spark", greeting: "Let's GO! Time to level up your knowledge!" },
};

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

  // Trigger streak celebration on first load if streak >= 3 and not shown today
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

  return (
    <div className="max-w-3xl mx-auto page-reveal space-y-6 pb-8">
      {/* Streak celebration */}
      <Celebration
        type="streak"
        title={`${mission.streak.current} Day Streak! 🔥`}
        subtitle="You're on fire. Keep it going!"
        icon="🔥"
        show={showStreakCelebration}
        onComplete={() => setShowStreakCelebration(false)}
      />

      {/* ===== HERO — Personal study world entrance ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border border-primary/10"
      >
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 gradient-mesh" />
        {/* Floating orbs */}
        <div className={`orb w-48 h-48 -top-12 -right-12 bg-gradient-to-br ${comp.gradient}`} style={{ animationDelay: "0s" }} />
        <div className={`orb w-32 h-32 -bottom-8 -left-8 bg-gradient-to-br ${comp.gradient}`} style={{ animationDelay: "5s", opacity: 0.15 }} />

        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                {atmosphere.icon} {atmosphere.greeting}, {firstName}
              </p>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mt-1">
                {mission.taskCount > 0 ? "Ready to learn?" : "All caught up 🎉"}
              </h1>
            </div>
            {/* Floating companion */}
            <CompanionAvatar icon={comp.icon} gradient={comp.gradient} size="lg" state="idle" />
          </div>

          {/* Companion greeting */}
          <div className="flex items-start gap-2 mb-5">
            <div className="flex-1">
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                "{companionGreeting}"
              </p>
            </div>
          </div>

          {/* Compact stats row — not cards, just pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Flame className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{mission.streak.current} day streak</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{mission.totalXP.toLocaleString()} XP</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-bold">Level {mission.level}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===== TODAY'S MISSION — Floating banner, not a card ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Today's Mission</h2>
          {mission.estimatedMinutes > 0 && (
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {mission.estimatedMinutes} min
            </span>
          )}
        </div>

        {mission.taskCount > 0 ? (
          <div className="space-y-2">
            {mission.tasks.slice(0, 3).map((task, i) => (
              <motion.button
                key={task.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                onClick={() => setView("learn")}
                className="w-full flex items-center gap-3 p-3 rounded-2xl glass-card hover:shadow-soft transition-all text-left group press"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  task.completed ? "bg-emerald-500" : task.type === "review" ? "bg-amber-500/80" : task.type === "analyze" ? "bg-cyan-500/80" : "bg-primary/15"
                }`}>
                  {task.completed ? <CheckCircle2 className="w-4 h-4 text-white" />
                    : task.type === "review" ? <Coffee className="w-4 h-4 text-white" />
                    : task.type === "analyze" ? <Sparkles className="w-4 h-4 text-white" />
                    : task.type === "xp" ? <Zap className="w-4 h-4 text-primary" />
                    : <BookOpen className="w-4 h-4 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{task.description}</p>
                </div>
                {task.estimatedMinutes > 0 && <span className="text-[10px] text-muted-foreground shrink-0">{task.estimatedMinutes}m</span>}
                {!task.completed && <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />}
              </motion.button>
            ))}

            {/* XP progress — minimal inline bar */}
            <div className="px-1 pt-1">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-muted-foreground">Daily XP</span>
                <span className="font-medium">{mission.xpEarnedToday} / {mission.xpTarget}</span>
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
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-medium">You're all caught up!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Great work. Come back tomorrow for new missions.</p>
          </div>
        )}

        {mission.streak.atRisk && mission.streak.current > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Your {mission.streak.current}-day streak needs attention — complete one task today.</p>
          </div>
        )}
      </motion.div>

      {/* ===== CONTEXTUAL RECOMMENDATION — dynamic based on real data ===== */}
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
            transition={{ delay: 0.15 }}
            className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-primary/[0.04] border border-primary/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80 leading-relaxed">{recommendations[0]}</p>
          </motion.div>
        ) : null;
      })()}

      {/* ===== AI INSIGHTS — companion wisdom ===== */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Learning Insights</h2>
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
                <p className="text-xs leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ===== CONTINUE LEARNING — or first-time welcome ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
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
                  <Card className="p-3 hover:shadow-soft transition-shadow flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{m.title}</p>
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
          /* First-time welcome — magical, not a form */
          <Card className="p-8 text-center border-dashed relative overflow-hidden">
            <div className="absolute inset-0 gradient-mesh opacity-30" />
            <div className="relative z-10">
              <CompanionAvatar icon={comp.icon} gradient={comp.gradient} size="xl" state="wave" className="mx-auto mb-4" />
              <h3 className="font-bold text-lg">Welcome to your study space</h3>
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

      {/* ===== UNANALYZED — gentle nudge ===== */}
      {unanalyzed.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          onClick={() => setView("learn")}
          className="w-full press"
        >
          <Card className="p-3.5 border-amber-500/20 bg-amber-500/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs flex-1"><span className="font-medium">{unanalyzed.length} {unanalyzed.length === 1 ? "document" : "documents"}</span> ready to analyze</p>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </Card>
        </motion.button>
      )}

      {/* ===== RECENT ACTIVITY — calming timeline ===== */}
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
          <Card className="p-4">
            <div className="space-y-2.5">
              {journey.timeline.slice(0, 4).map((event, i) => (
                <ActivityRow key={event.id} event={event} isLast={i === Math.min(3, journey.timeline.length - 1)} />
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

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
        <p className="text-xs font-medium leading-tight">{event.title}</p>
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
