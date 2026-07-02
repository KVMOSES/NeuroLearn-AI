"use client";

import { useEffect, useState } from "react";
import {
  Brain, Target, Zap, TrendingUp, Clock, Award, Activity, AlertTriangle,
  CheckCircle2, Sparkles, Rocket, ChevronRight, Flame, BookOpen, Share2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { TeachingAnalyticsDTO, JourneyDTO } from "@/lib/types";
import { LoadingState } from "@/components/empty-states";
import {
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Line, LineChart,
} from "recharts";
import { relativeTime } from "@/lib/ui";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { GamificationView } from "@/components/views/gamification-view";
import { KnowledgeView } from "@/components/views/knowledge-view";

type Tab = "overview" | "achievements" | "knowledge";

export function AnalyticsView() {
  const { setView } = useAppStore();
  const [data, setData] = useState<TeachingAnalyticsDTO | null>(null);
  const [journey, setJourney] = useState<JourneyDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    Promise.all([
      api.get<TeachingAnalyticsDTO>("/api/teaching/analytics"),
      api.get<JourneyDTO>("/api/teaching/journey"),
    ]).then(([a, j]) => {
      setData(a);
      setJourney(j);
    }).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <LoadingState message="Loading your progress…" />;

  // Render sub-views based on tab
  if (tab === "achievements") return <ProgressShell tab={tab} setTab={setTab}><GamificationView /></ProgressShell>;
  if (tab === "knowledge") return <ProgressShell tab={tab} setTab={setTab}><KnowledgeView /></ProgressShell>;

  const hasData = data.stats.topicsTracked > 0 || data.stats.totalLessons > 0 || data.stats.totalQuizzes > 0;
  const profileRadar = data.profile ? [
    { metric: "Knowledge", value: data.profile.priorKnowledge },
    { metric: "Concepts", value: data.profile.conceptualUnderstanding },
    { metric: "Reasoning", value: data.profile.reasoningAbility },
    { metric: "Confidence", value: data.profile.confidence },
    { metric: "Speed", value: data.profile.learningSpeed },
  ] : [];

  return (
    <ProgressShell tab={tab} setTab={setTab}>
      <div className="space-y-5">

      {/* Empty state */}
      {!hasData && (
        <Card className="p-10 text-center border-dashed">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4"
          >
            <Rocket className="w-8 h-8 text-primary" />
          </motion.div>
          <h3 className="font-bold text-lg">No analytics yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Upload a document, take a diagnostic, and complete lessons to start building your learning analytics.
          </p>
          <div className="flex gap-2 justify-center mt-5">
            <Button onClick={() => setView("learn")} className="bg-gradient-to-r from-primary to-primary text-white">
              <BookOpen className="w-4 h-4 mr-1" /> Start learning
            </Button>
            <Button variant="outline" onClick={() => setView("tutor")}>
              <Brain className="w-4 h-4 mr-1" /> Ask tutor
            </Button>
          </div>
        </Card>
      )}

      {/* XP this month + streak banner */}
      {hasData && journey && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatPill icon={Zap} label="XP (30d)" value={journey.summary.totalXP30d.toLocaleString()} color="text-amber-600 dark:text-amber-400 bg-amber-500/10" />
          <StatPill icon={BookOpen} label="Lessons" value={journey.summary.lessonsCompleted} color="text-primary bg-primary/10" />
          <StatPill icon={Target} label="Quizzes Passed" value={journey.summary.quizzesPassed} color="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" />
          <StatPill icon={Flame} label="Active Days" value={journey.summary.activeDays} color="text-rose-600 dark:text-rose-400 bg-rose-500/10" />
        </div>
      )}

      {/* Learner profile + reasoning improvement */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Learner profile radar */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> Learner Profile
              </h3>
              {data.profile && (
                <Badge variant="secondary" className="text-[10px] capitalize">{data.profile.preferredStyle}</Badge>
              )}
            </div>
            {profileRadar.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={profileRadar}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                  <Radar dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.3} strokeWidth={2} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center">
                <div className="text-center">
                  <Brain className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Take a diagnostic to build your profile</p>
                  <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={() => setView("learn")}>
                    Start diagnostic
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Quiz performance + reasoning */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Performance Trend
            </h3>
            {data.quizTrend.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.quizTrend} margin={{ left: -28, right: 8, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} vertical={false} />
                    <XAxis dataKey="attempt" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                    <Line type="monotone" dataKey="score" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ fill: "var(--chart-2)", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Reasoning improvement</p>
                    <p className={`text-lg font-bold ${data.reasoningImprovement > 0 ? "text-emerald-600 dark:text-emerald-400" : data.reasoningImprovement < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      {data.reasoningImprovement > 0 ? "+" : ""}{data.reasoningImprovement}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Avg quiz score</p>
                    <p className="text-lg font-bold">{data.avgQuizScore}%</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[240px] flex items-center justify-center">
                <div className="text-center">
                  <Target className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Take quizzes to see your performance trend</p>
                  <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={() => setView("quizzes")}>
                    Take a quiz
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Concept mastery + strengths/weaknesses */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Concept mastery */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Concept Mastery
            </h3>
            {data.conceptMastery.length > 0 ? (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto scrollbar-thin pr-2">
                {data.conceptMastery.map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate">{c.topic}</span>
                      <span className={`font-semibold ${c.retention > 70 ? "text-emerald-600" : c.retention < 40 ? "text-rose-600" : "text-amber-600"}`}>
                        {c.retention}%
                      </span>
                    </div>
                    <Progress value={c.retention} className="h-1.5" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">{c.document} · {c.repetitions} reviews · next: {relativeTime(c.nextReview)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Complete lessons to track concept mastery</p>
              </div>
            )}
          </Card>

          {/* Strengths & weaknesses */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Strengths & Weaknesses
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Strong Topics
                </p>
                {data.strongTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {data.strongTopics.map((t) => <Badge key={t} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">{t}</Badge>)}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No strong topics yet — keep learning!</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Needs Work
                </p>
                {data.weakTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {data.weakTopics.map((t) => <Badge key={t} className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px]">{t}</Badge>)}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No weak topics identified.</p>
                )}
              </div>
              {data.profile?.misconceptions && data.profile.misconceptions.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Misconceptions
                  </p>
                  <div className="space-y-1">
                    {data.profile.misconceptions.map((m, i) => (
                      <div key={i} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px]">
                        <span className="font-medium">{m.topic}:</span> {m.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Learning plan progress */}
      {hasData && data.planProgress.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> Learning Plans
          </h3>
          <div className="space-y-2">
            {data.planProgress.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{p.document}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={p.progress} className="h-1.5 flex-1 max-w-[200px]" />
                    <span className="text-[10px] text-muted-foreground">{p.completedTopics}/{p.totalTopics} · {p.estimatedMinutes}m</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-primary shrink-0">{p.progress}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      </div>
    </ProgressShell>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-bold leading-tight">{value}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Shell with tabs for the unified Progress page
function ProgressShell({ tab, setTab, children }: { tab: Tab; setTab: (t: Tab) => void; children: React.ReactNode }) {
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: TrendingUp },
    { key: "achievements", label: "Achievements", icon: Award },
    { key: "knowledge", label: "Knowledge Graph", icon: Share2 },
  ];
  return (
    <div className="max-w-5xl mx-auto fade-in space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track your mastery, retention, and growth over time.</p>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
