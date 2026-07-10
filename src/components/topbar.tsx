"use client";

import { Bell, Moon, Search, Sun, LogOut, ChevronDown, Command, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { levelTitle } from "@/lib/ui";
import { useMemo } from "react";
import { toast } from "sonner";

const VIEW_TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Home", sub: "Your personal study space" },
  learn: { title: "Learn", sub: "Your AI teacher & learning materials" },
  tutor: { title: "AI Tutor", sub: "Your personal AI mentor" },
  analytics: { title: "Progress", sub: "Your learning journey" },
  "lesson-studio": { title: "Lesson Studio", sub: "Generate presentations, notes, courses & more" },
  settings: { title: "Settings", sub: "Account & preferences" },
};

export function Topbar() {
  const { view, me, logout, setView, setCommandOpen } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const meta = VIEW_TITLES[view] ?? { title: "NeuroLearn", sub: "" };

  const initials = useMemo(() => {
    if (!me) return "?";
    return me.user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }, [me]);

  async function handleLogout() {
    await logout();
    toast.success("Signed out");
  }

  return (
    <header className="sticky top-0 z-20 h-16 border-b glass bg-background/30 backdrop-blur-xl flex items-center gap-3 px-4 lg:px-6">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold leading-tight tracking-tight truncate">{meta.title}</h1>
        <p className="text-[11px] text-muted-foreground leading-tight truncate">{meta.sub}</p>
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="hidden md:flex items-center gap-2 ml-6 px-2.5 py-1.5 rounded-lg border bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors text-xs w-56"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="text-[9px] font-medium border rounded px-1 py-0.5">⌘K</kbd>
      </button>

      <div className="flex items-center gap-1 ml-auto">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-muted transition-colors">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary text-white text-[10px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-tight max-w-[110px] truncate">{me?.user.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Lvl {me?.gamification.level}</p>
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="pb-2">
              <p className="font-semibold text-sm">{me?.user.name}</p>
              <p className="text-xs text-muted-foreground font-normal truncate">{me?.user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="secondary" className="text-[9px] capitalize px-1.5 py-0">{me?.user.role.toLowerCase()}</Badge>
                <span className="text-[10px] text-muted-foreground">{me && levelTitle(me.gamification.level)}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView("settings")} className="text-xs">
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("analytics")} className="text-xs">
              My Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("gamification")} className="text-xs">
              Achievements
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600">
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
