"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Timer, Play, Pause, RotateCcw, Coffee, Brain, Zap, Flame,
  CheckCircle2, TrendingUp, Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Confetti } from "@/components/confetti";
import { useAppStore } from "@/lib/store";

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

const AMBIENCES = [
  { key: "none", label: "None", icon: "🔇" },
  { key: "rain", label: "Rain", icon: "🌧️" },
  { key: "forest", label: "Forest", icon: "🌲" },
  { key: "ocean", label: "Ocean", icon: "🌊" },
  { key: "cafe", label: "Café", icon: "☕" },
  { key: "lofi", label: "Lo-fi", icon: "🎵" },
  { key: "whitenoise", label: "White Noise", icon: "📻" },
];

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
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Handle phase completion
  const handlePhaseComplete = useCallback(() => {
    if (phase === "focus") {
      // Record the focus session
      const minutes = MODES[mode].focus;
      setRecording(true);
      api.post("/api/teaching/focus", { durationMinutes: minutes, type: "pomodoro" })
        .then((r: any) => {
          toast.success(`Focus session complete! +${r.xpEarned} XP 🎉`);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2500);
          setCompletedSessions((c) => c + 1);
          loadStats();
        })
        .catch(() => toast.error("Failed to record session"))
        .finally(() => setRecording(false));

      // Switch to break
      setPhase("break");
      setSecondsLeft(MODES[mode].break * 60);
    } else if (phase === "break") {
      // Break complete — ready for next focus
      setPhase("idle");
      setSecondsLeft(MODES[mode].focus * 60);
      toast.info("Break over — ready for the next session? 💪");
    }
  }, [phase, mode, loadStats]);

  // Timer tick
  useEffect(() => {
    if (phase === "idle") return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Phase complete
          handlePhaseComplete();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, handlePhaseComplete]);

  function start() {
    if (phase === "idle") {
      setPhase("focus");
      setSecondsLeft(MODES[mode].focus * 60);
    }
  }

  function pause() {
    setPhase("idle");
  }

  function reset() {
    setPhase("idle");
    setSecondsLeft(MODES[mode].focus * 60);
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Focus Timer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Stay focused with the Pomodoro technique. Earn XP for every minute you study.</p>
        </div>

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
                <Button
                  onClick={start}
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 h-12 px-8 text-base font-semibold scale-tap"
                >
                  <Play className="w-5 h-5 mr-2" /> Start focusing
                </Button>
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
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                  className="w-20 h-1 accent-primary"
                />
              </div>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {AMBIENCES.map((a) => (
              <button
                key={a.key}
                onClick={() => {
                  setAmbience(a.key);
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                  }
                  if (a.key !== "none") {
                    // Use Web Audio API to generate ambient noise
                    playAmbientSound(a.key, volume);
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

// Ambient sound generator using Web Audio API
let ambientCtx: AudioContext | null = null;
let ambientNodes: any[] = [];

function playAmbientSound(type: string, volume: number) {
  // Stop existing
  stopAmbientSound();
  if (typeof window === "undefined") return;

  try {
    ambientCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch { return; }

  const masterGain = ambientCtx.createGain();
  masterGain.gain.value = volume * 0.3;
  masterGain.connect(ambientCtx.destination);

  if (type === "rain" || type === "whitenoise") {
    // White noise → filtered for rain/white noise
    const bufferSize = 2 * ambientCtx.sampleRate;
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ambientCtx.createBiquadFilter();
    filter.type = type === "rain" ? "lowpass" : "allpass";
    filter.frequency.value = type === "rain" ? 800 : 5000;
    source.connect(filter);
    filter.connect(masterGain);
    source.start();
    ambientNodes.push(source);
  } else if (type === "ocean") {
    // Low-frequency oscillation for ocean waves
    const osc = ambientCtx.createOscillator();
    osc.frequency.value = 0.1;
    const gain = ambientCtx.createGain();
    gain.gain.value = 0.5;
    const lfo = ambientCtx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ambientCtx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    lfo.start();
    ambientNodes.push(osc, lfo);
  } else if (type === "forest" || type === "cafe") {
    // Brown noise with different filtering
    const bufferSize = 2 * ambientCtx.sampleRate;
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const source = ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ambientCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = type === "forest" ? 400 : 600;
    source.connect(filter);
    filter.connect(masterGain);
    source.start();
    ambientNodes.push(source);
  } else if (type === "lofi") {
    // Simple low-frequency hum for lo-fi vibe
    const osc = ambientCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 220;
    const gain = ambientCtx.createGain();
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    ambientNodes.push(osc);
  }
}

function stopAmbientSound() {
  ambientNodes.forEach((n) => { try { n.stop?.(); } catch {} });
  ambientNodes = [];
  if (ambientCtx) { try { ambientCtx.close(); } catch {} ambientCtx = null; }
}
