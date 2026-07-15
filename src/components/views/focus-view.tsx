"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Timer, Play, Pause, RotateCcw, Coffee, Brain, Zap, Flame,
  CheckCircle2, TrendingUp, Clock, Volume2, VolumeX, Settings,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Confetti } from "@/components/confetti";
import { useAppStore } from "@/lib/store";
import { playTimerSound, preloadAudio, setMasterVolume, getMasterVolume, setMuted, getMuted, startAmbient, stopAmbient, TIMER_SOUNDS, AMBIENT_SOUNDS } from "@/lib/audio";

type Phase = "focus" | "break" | "idle";
type Mode = "pomodoro" | "short" | "long";

const MODES: Record<Mode, { focus: number; break: number; label: string; icon: any; color: string }> = {
  pomodoro: { focus: 25, break: 5, label: "Pomodoro", icon: Brain, color: "from-primary to-primary" },
  short: { focus: 15, break: 3, label: "Quick", icon: Zap, color: "from-emerald-600 to-teal-600" },
  long: { focus: 50, break: 10, label: "Deep Work", icon: Flame, color: "from-amber-500 to-orange-500" },
};

interface FocusStats {
  totalSessions: number;
  totalMinutes: number;
  todayMinutes: number;
  sessionsByDay: { date: string; minutes: number }[];
}

export function FocusView() {
  const { me } = useAppStore();
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(MODES.pomodoro.focus * 60);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [stats, setStats] = useState<FocusStats | null>(null);
  const [recording, setRecording] = useState(false);
  const [ambience, setAmbience] = useState("none");
  const [volume, setVolume] = useState(getMasterVolume() * 100);
  const [muted, setMutedState] = useState(getMuted());
  const [selectedSound, setSelectedSound] = useState("chime");
  const [showSettings, setShowSettings] = useState(false);
  const [wasPaused, setWasPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const d = await api.get<FocusStats>("/api/teaching/focus");
      setStats(d);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    api.get<FocusStats>("/api/teaching/focus")
      .then(setStats)
      .catch(() => {});
  }, []);

  // Use a ref to track if we're currently completing to prevent double-fires
  const completingRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const soundRef = useRef(selectedSound);
  soundRef.current = selectedSound;

  // Handle phase completion — called when timer hits zero
  const handlePhaseComplete = useCallback(() => {
    if (completingRef.current) return; // prevent double-fire
    completingRef.current = true;

    // Clear the interval immediately to stop further ticks
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const currentPhase = phaseRef.current;
    const currentMode = modeRef.current;
    const currentSound = soundRef.current;

    if (currentPhase === "focus") {
      // Play session complete sound
      playTimerSound("session_complete", currentSound);
      
      // Record the focus session
      const minutes = MODES[currentMode].focus;
      api.post("/api/teaching/focus", { durationMinutes: minutes, type: "pomodoro" })
        .then((r: any) => {
          toast.success(`Focus session complete! +${r.xpEarned} XP 🎉`);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2500);
          setCompletedSessions((c) => c + 1);
          loadStats();
        })
        .catch(() => toast.error("Failed to record session"));

      // Switch to break
      setPhase("break");
      setSecondsLeft(MODES[currentMode].break * 60);
    } else if (currentPhase === "break") {
      // Play break complete sound
      playTimerSound("break_complete", currentSound);
      
      // Break complete — ready for next focus
      setPhase("idle");
      setSecondsLeft(MODES[currentMode].focus * 60);
      toast.info("Break over — ready for the next session? 💪");
    }

    completingRef.current = false;
  }, [loadStats]);

  // Timer tick
  useEffect(() => {
    if (phase === "idle") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Don't call handlePhaseComplete from inside setState callback
          // Instead, schedule it after the state update
          setTimeout(() => handlePhaseComplete(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase, handlePhaseComplete]);

  // Stop ambient sound when component unmounts
  useEffect(() => {
    return () => {
      stopAmbient();
    };
  }, []);

  function start() {
    if (phase === "idle") {
      preloadAudio();
      playTimerSound("start", selectedSound);
      setPhase("focus");
      setSecondsLeft(MODES[mode].focus * 60);
      setWasPaused(false);
    }
  }

  function pause() {
    playTimerSound("pause", selectedSound);
    setPhase("idle");
    setWasPaused(true);
  }

  function resume() {
    playTimerSound("resume", selectedSound);
    setPhase("focus");
  }

  function reset() {
    setPhase("idle");
    setSecondsLeft(MODES[mode].focus * 60);
    setWasPaused(false);
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setPhase("idle");
    setSecondsLeft(MODES[newMode].focus * 60);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const currentMode = MODES[mode];
  const totalSeconds = (phase === "break" ? currentMode.break : currentMode.focus) * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  return (
    <>
      <Confetti show={showConfetti} />
      <div className="max-w-2xl mx-auto fade-in space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Focus Timer</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Stay focused with the Pomodoro technique. Earn XP for every minute you study.</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-4 space-y-3">
                {/* Sound selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Timer Sound</span>
                    <span className="text-xs text-muted-foreground">
                      {selectedSound === "none" ? "Silent" : `Playing: ${TIMER_SOUNDS.find(s => s.key === selectedSound)?.label}`}
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {TIMER_SOUNDS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => { setSelectedSound(s.key); if (s.key !== "none") playTimerSound("start", s.key); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                          selectedSound === s.key ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume control */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">Volume</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const newMuted = !muted;
                          setMutedState(newMuted);
                          setMuted(newMuted);
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        {muted ? <VolumeX size={14} className="text-muted-foreground" /> : <Volume2 size={14} className="text-primary" />}
                      </button>
                      <span className="text-[11px] text-muted-foreground w-8 text-right">{Math.round(volume)}%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      const normal = v / 100;
                      setMasterVolume(normal);
                      if (muted && v > 0) {
                        setMutedState(false);
                        setMuted(false);
                      }
                    }}
                    className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm
                      [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                  />
                </div>

                {/* Ambient sound hint */}
                <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-2">
                  Timer sounds are separate from ambient sounds below. Each event (start, pause, resume, session complete, break complete) has its own unique sound.
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode selector */}
        <div className="flex gap-2">
          {(Object.keys(MODES) as Mode[]).map((m) => {
            const config = MODES[m];
            const Icon = config.icon;
            return (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  mode === m
                    ? `border-transparent bg-gradient-to-br ${config.color} text-white shadow-md`
                    : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{config.label}</span>
                <span className={`text-[10px] ${mode === m ? "text-white/70" : "text-muted-foreground"}`}>{config.focus}m focus</span>
              </button>
            );
          })}
        </div>

        {/* Timer circle */}
        <Card className={`relative overflow-hidden p-8 border-0 bg-gradient-to-br ${currentMode.color} text-white shadow-xl`}>
          <div className="absolute inset-0 grid-bg-white opacity-[0.05]" />
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Phase label */}
            <div className="flex items-center gap-1.5 mb-4">
              {phase === "break" ? <Coffee className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
              <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
                {phase === "break" ? "Break Time" : phase === "idle" ? "Ready to Focus" : "Focusing"}
              </span>
            </div>

            {/* Circular progress */}
            <div className="relative w-56 h-56 mb-6">
              <svg className="w-56 h-56 -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                <circle
                  cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 90}`}
                  strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold tabular-nums tracking-tight">{timeStr}</span>
                <span className="text-xs text-white/60 mt-1">
                  {phase === "break" ? `${currentMode.break} min break` : `${currentMode.focus} min focus`}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {phase === "idle" ? (
                wasPaused ? (
                  <Button
                    onClick={resume}
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90 h-12 px-8 text-base font-semibold scale-tap"
                  >
                    <Play className="w-5 h-5 mr-2" /> Resume
                  </Button>
                ) : (
                  <Button
                    onClick={start}
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90 h-12 px-8 text-base font-semibold scale-tap"
                  >
                    <Play className="w-5 h-5 mr-2" /> Start focusing
                  </Button>
                )
              ) : (
                <Button
                  onClick={pause}
                  size="lg"
                  className="bg-white/20 backdrop-blur text-white hover:bg-white/30 border border-white/20 h-12 px-8 text-base font-semibold scale-tap"
                >
                  <Pause className="w-5 h-5 mr-2" /> Pause
                </Button>
              )}
              <Button
                onClick={reset}
                size="lg"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 h-12 w-12 p-0 scale-tap"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>

            {/* Session counter */}
            {completedSessions > 0 && (
              <div className="flex items-center gap-1.5 mt-4 text-xs text-white/70">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completedSessions} session{completedSessions > 1 ? "s" : ""} completed today
              </div>
            )}
          </div>
        </Card>

        {/* Ambience selector */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Ambient Sound</span>
            {ambience !== "none" && (
              <span className="text-[10px] text-muted-foreground ml-auto">{AMBIENT_SOUNDS.find(a => a.key === ambience)?.label}</span>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {AMBIENT_SOUNDS.map((a) => (
              <button
                key={a.key}
                onClick={() => {
                  setAmbience(a.key);
                  stopAmbient();
                  if (a.key !== "none") {
                    preloadAudio();
                    startAmbient(a.key, getMasterVolume());
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 transition-all ${
                  ambience === a.key ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {stats && stats.totalSessions > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Today</p>
                  <p className="text-sm font-bold">{stats.todayMinutes}m</p>
                </div>
              </div>
            </Card>
            <Card className="p-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold">{stats.totalMinutes}m</p>
                </div>
              </div>
            </Card>
            <Card className="p-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Sessions</p>
                  <p className="text-sm font-bold">{stats.totalSessions}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Study heatmap (last 14 days) */}
        {stats && stats.sessionsByDay.length > 0 && (
          <Card className="p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Study Activity (14 days)
            </h3>
            <div className="flex gap-1">
              {Array.from({ length: 14 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (13 - i));
                const key = date.toISOString().slice(0, 10);
                const minutes = stats.sessionsByDay.find((d) => d.date === key)?.minutes ?? 0;
                const intensity = Math.min(1, minutes / 50);
                return (
                  <div
                    key={i}
                    title={`${key}: ${minutes}m`}
                    className="flex-1 h-8 rounded-sm transition-colors"
                    style={{
                      background: minutes === 0
                        ? "var(--muted)"
                        : `oklch(0.6 0.22 290 / ${0.3 + intensity * 0.7})`,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              <span>14 days ago</span>
              <div className="flex items-center gap-1">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-muted" />
                <div className="w-3 h-3 rounded-sm" style={{ background: "oklch(0.6 0.22 290 / 0.6)" }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: "oklch(0.6 0.22 290 / 1)" }} />
                <span>More</span>
              </div>
              <span>Today</span>
            </div>
          </Card>
        )}

        {/* XP info */}
        <Card className="p-4 bg-primary/5 border-primary/15">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">Earn 1 XP per minute of focused study</p>
              <p className="text-[10px] text-muted-foreground">Complete focus sessions to earn XP, build your streak, and improve your consistency score.</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}