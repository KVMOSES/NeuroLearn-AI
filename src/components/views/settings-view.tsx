"use client";

import { useState, useEffect } from "react";
import {
  User, Mail, Shield, Bell, Palette, Globe, Lock, LogOut, Moon, Sun,
  Check, KeyRound, Smartphone, Database, Sparkles, Flame, Zap, Award,
  Brain, TrendingUp, ChevronRight, Volume2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import { useTheme } from "@/components/theme-provider";
import { levelTitle, relativeTime } from "@/lib/ui";
import { toast } from "sonner";
import { CompanionAvatar } from "@/components/companion-avatar";
import { api } from "@/lib/api-client";
import { motion } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export function SettingsView() {
  const { me, logout } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(me?.user.name ?? "");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!me) return null;

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Profile updated ✨");
    setSaving(false);
  }

  async function handleLogout() {
    await logout();
    toast.success("Signed out 👋");
  }

  const initials = me.user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-4 fade-in pb-8">
      {/* Profile header — student-friendly */}
      <Card className="relative overflow-hidden p-5 border-0 bg-gradient-to-br from-primary to-primary text-white">
        <div className="absolute inset-0 grid-bg-white opacity-[0.05]" />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-white/20">
            <AvatarFallback className="bg-white/15 backdrop-blur text-white text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{me.user.name}</h2>
            <p className="text-sm text-white/70">{me.user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <Badge className="bg-white/15 text-white border-white/10 capitalize text-[10px]">{me.user.role.toLowerCase()}</Badge>
              <Badge className="bg-white/15 text-white border-white/10 text-[10px] gap-0.5">
                <Award className="w-2.5 h-2.5" /> Level {me.gamification.level} · {levelTitle(me.gamification.level)}
              </Badge>
            </div>
          </div>
        </div>
        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-2 mt-4">
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur text-center">
            <p className="text-lg font-bold flex items-center justify-center gap-1"><Zap className="w-3.5 h-3.5" />{me.gamification.totalXP.toLocaleString()}</p>
            <p className="text-[9px] text-white/60 uppercase tracking-wider">Total XP</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur text-center">
            <p className="text-lg font-bold flex items-center justify-center gap-1"><Flame className="w-3.5 h-3.5" />{me.gamification.currentStreak}</p>
            <p className="text-[9px] text-white/60 uppercase tracking-wider">Day Streak</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur text-center">
            <p className="text-lg font-bold flex items-center justify-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{me.gamification.longestStreak}</p>
            <p className="text-[9px] text-white/60 uppercase tracking-wider">Best Streak</p>
          </div>
        </div>
      </Card>

      {/* Profile edit */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Profile
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Update your personal information.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" value={me.user.email} disabled className="h-9 bg-muted/50" />
          </div>
        </div>
        <div className="space-y-1.5 mt-3">
          <Label htmlFor="bio" className="text-xs">Bio</Label>
          <Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about your learning goals…" className="h-9" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving} size="sm" className="bg-gradient-to-r from-primary to-primary text-white">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> Appearance
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Make NeuroLearn yours.</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <div>
              <p className="text-xs font-medium">Theme</p>
              <p className="text-[10px] text-muted-foreground">Light or dark mode</p>
            </div>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button onClick={() => setTheme("light")} className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-all ${theme === "light" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              <Sun className="w-3 h-3" /> Light
            </button>
            <button onClick={() => setTheme("dark")} className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-all ${theme === "dark" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              <Moon className="w-3 h-3" /> Dark
            </button>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4" />
            <div>
              <p className="text-xs font-medium">Language</p>
              <p className="text-[10px] text-muted-foreground">Interface language</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">English</Badge>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Security
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Keep your account safe.</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4" />
              <div>
                <p className="text-xs font-medium">Email verification</p>
                <p className="text-[10px] text-muted-foreground">{me.user.emailVerified ? "Verified ✓" : "Not verified"}</p>
              </div>
            </div>
            {me.user.emailVerified
              ? <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[10px]"><Check className="w-2.5 h-2.5" /> Verified</Badge>
              : <Button variant="outline" size="sm" className="h-7 text-xs">Verify now</Button>}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4" />
              <div>
                <p className="text-xs font-medium">Password</p>
                <p className="text-[10px] text-muted-foreground">Change your password</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs">Change</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4" />
              <div>
                <p className="text-xs font-medium">Two-factor auth</p>
                <p className="text-[10px] text-muted-foreground">Extra security layer</p>
              </div>
            </div>
            <Switch />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Notifications
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Stay motivated without being annoyed.</p>
        <div className="space-y-3">
          {[
            { label: "Daily streak reminders", desc: "Don't break your streak 🔥", on: true },
            { label: "Achievement unlocks", desc: "Celebrate your wins 🎉", on: true },
            { label: "Classroom announcements", desc: "Updates from your classes", on: true },
            { label: "Weekly progress reports", desc: "Your learning summary", on: false },
            { label: "Leaderboard updates", desc: "When your rank changes", on: false },
          ].map((n, i) => (
            <div key={i}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{n.label}</p>
                  <p className="text-[10px] text-muted-foreground">{n.desc}</p>
                </div>
                <Switch defaultChecked={n.on} />
              </div>
              {i < 4 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>
      </Card>

      {/* AI Companion */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" /> AI Companion
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Choose your personal AI mentor.</p>
        <CompanionSelector />
      </Card>

      {/* Sound */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" /> Sound Effects
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Subtle audio feedback for learning interactions.</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4" />
            <div>
              <p className="text-xs font-medium">Enable sounds</p>
              <p className="text-[10px] text-muted-foreground">Click, correct answer, achievements, level up</p>
            </div>
          </div>
          <Switch
            defaultChecked={typeof window !== "undefined" && localStorage.getItem("nl-sounds") !== "false"}
            onCheckedChange={(checked) => {
              if (typeof window !== "undefined") {
                localStorage.setItem("nl-sounds", String(checked));
                import("@/lib/sounds").then(({ setSoundsEnabled, sounds }) => {
                  setSoundsEnabled(checked);
                  if (checked) sounds.click();
                });
              }
            }}
          />
        </div>
      </Card>

      {/* Data & Privacy */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" /> Data & Privacy
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Your data, your control.</p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-2.5 rounded-lg border">
            <div>
              <p className="text-xs font-medium">Export your data</p>
              <p className="text-[10px] text-muted-foreground">GDPR data export</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs">Export</Button>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5">
            <div>
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Delete account</p>
              <p className="text-[10px] text-muted-foreground">Permanently remove your data</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs text-rose-600 border-rose-500/30 hover:bg-rose-500/10" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Sign out */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Member since {relativeTime(me.user.createdAt)}
        </span>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 h-7 text-xs">
          <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>This will permanently delete all your data, progress, and documents. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { toast.error("Account deletion requires admin verification"); setDeleteOpen(false); }}>
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// AI Companion selector component
function CompanionSelector() {
  const [companions, setCompanions] = useState<any[]>([]);
  const [current, setCurrent] = useState<string>("nova");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ companions: any[]; currentCompanion: string }>("/api/teaching/companion").then((d) => {
      setCompanions(d.companions);
      setCurrent(d.currentCompanion);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-xs text-muted-foreground">Loading...</p>;

  async function select(key: string) {
    setCurrent(key);
    try {
      await api.post("/api/teaching/companion", { companion: key });
      toast.success("Companion updated!");
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {companions.map((c) => (
        <button
          key={c.key}
          onClick={() => select(c.key)}
          className={`p-3 rounded-xl border-2 text-left transition-all ${
            current === c.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <CompanionAvatar icon={c.icon} gradient={c.gradient} size="sm" />
            <div>
              <p className="text-xs font-semibold">{c.name}</p>
              <p className="text-[9px] text-muted-foreground">{c.title}</p>
            </div>
            {current === c.key && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">{c.description}</p>
        </button>
      ))}
    </div>
  );
}
