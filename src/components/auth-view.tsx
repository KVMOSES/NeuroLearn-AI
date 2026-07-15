"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight,
  ShieldCheck, TrendingUp, Zap, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { validatePasswordStrengthClient } from "@/lib/password-strength";

export function AuthView() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const loadMe = useAppStore((s) => s.loadMe);

  const pwStrength = validatePasswordStrengthClient(form.password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await api.post("/api/auth/login", { email: form.email, password: form.password });
        toast.success("Welcome back!");
      } else {
        await api.post("/api/auth/register", {
          name: form.name,
          email: form.email,
          password: form.password,
          role: "STUDENT",
        });
        toast.success("Account created. Welcome to NeuroLearn AI.");
      }
      await loadMe();
    } catch (err) {
      toast.error((err as Error).message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 mesh-bg opacity-60" />
        <div className="absolute inset-0 grid-bg-white opacity-30" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">NeuroLearn AI</p>
              <p className="text-xs text-white/50">Adaptive Learning Platform</p>
            </div>
          </div>

          <div className="max-w-md">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight"
            >
              The learning platform that <span className="gradient-text-warm">adapts to you.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-white/60 text-base mt-5 leading-relaxed"
            >
              Bayesian Knowledge Tracing, spaced repetition, and a RAG-powered AI tutor that
              learns from your documents. Built for serious learners.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-1 gap-3 mt-10"
            >
              {[
                { icon: TrendingUp, title: "Adaptive mastery tracking", desc: "BKT estimates what you actually know, per skill." },
                { icon: Zap, title: "Spaced repetition", desc: "SM-2 schedules reviews at the optimal moment." },
                { icon: ShieldCheck, title: "Your documents, grounded", desc: "RAG answers with citations from your library." },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/20 border border-white/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-4 h-4 text-primary/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-white/50 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <p className="text-xs text-white/40">Trusted by learners across 40+ institutions</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">NeuroLearn AI</p>
              <p className="text-[11px] text-muted-foreground">Adaptive Learning</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-semibold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                {mode === "login"
                  ? "Sign in to continue your learning journey."
                  : "Start mastering skills with an AI tutor by your side."}
              </p>

              <form onSubmit={submit} className="space-y-4 mt-8">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        id="name"
                        className="pl-9 h-10"
                        placeholder="Ada Lovelace"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9 h-10"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      className="pl-9 pr-10 h-10"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {mode === "register" && form.password.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i < pwStrength.score
                                ? pwStrength.score <= 1
                                  ? "bg-rose-500"
                                  : pwStrength.score <= 2
                                  ? "bg-amber-500"
                                  : pwStrength.score <= 3
                                  ? "bg-yellow-500"
                                  : "bg-emerald-500"
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      {pwStrength.reasons.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Needs: {pwStrength.reasons.join(" · ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {mode === "login" && (
                  <div className="text-right -mt-1">
                    <a
                      href="/reset-password"
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 text-sm bg-gradient-to-r from-primary to-primary hover:opacity-90 text-white shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "login" ? "Sign in" : "Create account"}
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center text-xs text-muted-foreground">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setMode(mode === "login" ? "register" : "login")}
                  className="text-primary font-medium hover:underline"
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
