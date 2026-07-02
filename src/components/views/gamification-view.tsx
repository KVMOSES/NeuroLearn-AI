"use client";

import { useEffect, useState } from "react";
import { Trophy, Flame, Zap, TrendingUp, Medal, Crown, Star, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";
import type { LeaderboardEntry, AchievementDef } from "@/lib/types";
import { LoadingState, PageHeader } from "@/components/empty-states";
import { iconFor, levelTitle, TIER_COLORS, TIER_RING } from "@/lib/ui";
import { useAppStore } from "@/lib/store";
import { motion } from "framer-motion";

export function GamificationView() {
  const { me } = useAppStore();
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ leaderboard: LeaderboardEntry[] }>("/api/gamification/leaderboard?limit=20"),
      api.get<{ achievements: AchievementDef[] }>("/api/gamification/achievements"),
    ]).then(([b, a]) => {
      setBoard(b.leaderboard);
      setAchievements(a.achievements);
      setLoading(false);
    });
  }, []);

  if (loading || !me) return <LoadingState message="Loading achievements…" />;

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto fade-in">
      <PageHeader title="Achievements" description="XP, levels, streaks, and the global leaderboard." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-primary to-primary text-white border-0">
          <Zap className="w-4 h-4 mb-1.5 opacity-80" />
          <p className="text-2xl font-bold">{me.gamification.totalXP.toLocaleString()}</p>
          <p className="text-[11px] text-white/70">Total XP</p>
        </Card>
        <Card className="p-4">
          <TrendingUp className="w-4 h-4 mb-1.5 text-primary" />
          <p className="text-2xl font-bold">Lvl {me.gamification.level}</p>
          <p className="text-[11px] text-muted-foreground">{levelTitle(me.gamification.level)}</p>
          <Progress value={me.gamification.levelProgressPct} className="h-1 mt-1.5" />
        </Card>
        <Card className="p-4">
          <Flame className="w-4 h-4 mb-1.5 text-amber-500" />
          <p className="text-2xl font-bold">{me.gamification.currentStreak}</p>
          <p className="text-[11px] text-muted-foreground">Day streak · best {me.gamification.longestStreak}</p>
        </Card>
        <Card className="p-4">
          <Trophy className="w-4 h-4 mb-1.5 text-emerald-500" />
          <p className="text-2xl font-bold">{earnedCount}<span className="text-base text-muted-foreground">/{achievements.length}</span></p>
          <p className="text-[11px] text-muted-foreground">Achievements</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Leaderboard */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Leaderboard</h3>
          <div className="space-y-1 max-h-[460px] overflow-y-auto scrollbar-thin">
            {board.map((entry, i) => {
              const isMe = entry.id === me.user.id;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`flex items-center gap-2.5 p-2 rounded-lg ${isMe ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/60"}`}
                >
                  <div className="w-5 flex justify-center">
                    {i === 0 ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : i === 1 ? <Medal className="w-3.5 h-3.5 text-slate-400" /> : i === 2 ? <Medal className="w-3.5 h-3.5 text-amber-700" /> : <span className="text-[10px] text-muted-foreground">{i + 1}</span>}
                  </div>
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary text-white text-[9px] font-semibold">
                      {entry.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{entry.name}{isMe && " · you"}</p>
                    <p className="text-[9px] text-muted-foreground">Lvl {entry.level} · {levelTitle(entry.level)} · {entry.currentStreak}🔥</p>
                  </div>
                  <span className="text-xs font-bold text-primary">{entry.totalXP >= 1000 ? `${(entry.totalXP / 1000).toFixed(1)}k` : entry.totalXP}</span>
                </motion.div>
              );
            })}
          </div>
        </Card>

        {/* Achievements */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> Achievements</h3>
          <p className="text-xs text-muted-foreground mb-3">{earnedCount} of {achievements.length} unlocked</p>
          <div className="grid grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
            {achievements.map((a, i) => {
              const Icon = iconFor(a.icon);
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`relative p-3 rounded-xl border text-center transition-all ${
                    a.earned ? "border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5" : "border-border opacity-60"
                  }`}
                >
                  <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-1.5 ring-1 ${
                    a.earned ? `bg-gradient-to-br ${TIER_COLORS[a.tier] ?? "from-primary to-primary"} ${TIER_RING[a.tier] ?? "ring-violet-400/30"}` : "bg-muted ring-border"
                  }`}>
                    <Icon className={`w-5 h-5 ${a.earned ? "text-white" : "text-muted-foreground"}`} />
                  </div>
                  <p className="text-xs font-semibold leading-tight">{a.name}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{a.description}</p>
                  <Badge variant="outline" className="mt-1.5 text-[8px] gap-0.5 px-1 py-0">
                    <Star className="w-2 h-2" /> +{a.xpReward}
                  </Badge>
                  {!a.earned && (
                    <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-background/30 backdrop-blur-[1px]">
                      <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">Locked</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
