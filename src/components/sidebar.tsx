"use client";

import { useMemo } from "react";
import {
  Home, GraduationCap, Bot, BarChart3, Settings, Sparkles,
  Brain, ChevronLeft, Flame, Command, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { ViewKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { levelTitle } from "@/lib/ui";
import { motion } from "framer-motion";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof Home;
  group: string;
  hint?: string;
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "Home", icon: Home, group: "Study Space" },
  { key: "learn", label: "Learn", icon: GraduationCap, group: "Study Space" },
  { key: "tutor", label: "AI Tutor", icon: Bot, group: "Study Space" },
  { key: "lesson-studio", label: "Lesson Studio", icon: Sparkles, group: "Study Space" },
  { key: "analytics", label: "Progress", icon: BarChart3, group: "Study Space" },
  { key: "settings", label: "Settings", icon: Settings, group: "Account" },
];

const GROUPS = ["Study Space", "Account"];

export function Sidebar() {
  const { view, setView, sidebarCollapsed, toggleSidebar, me, setCommandOpen } = useAppStore();

  const initials = useMemo(() => {
    if (!me) return "?";
    return me.user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }, [me]);

  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 sticky top-0 h-screen border-r bg-sidebar flex-col transition-all duration-300 z-30",
        sidebarCollapsed ? "w-[64px]" : "w-[244px]"
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-3.5 border-b shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary flex items-center justify-center shrink-0 shadow-sm">
          <Brain className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden flex-1">
            <p className="font-semibold leading-tight tracking-tight text-sm">NeuroLearn</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Adaptive Learning</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Command trigger */}
      {!sidebarCollapsed && (
        <div className="p-3">
          <button
            onClick={() => setCommandOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors text-xs"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[9px] font-medium border rounded px-1 py-0.5">⌘K</kbd>
          </button>
        </div>
      )}
      {sidebarCollapsed && (
        <div className="p-2 flex justify-center">
          <button
            onClick={() => setCommandOpen(true)}
            className="w-9 h-9 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Search"
          >
            <Command className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-3">
              {!sidebarCollapsed && (
                <p className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">{group}</p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = view === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setView(item.key)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all relative group",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "font-medium text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                        sidebarCollapsed && "justify-center px-0"
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="nav-active-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary"
                        />
                      )}
                      <Icon className={cn("w-4 h-4 shrink-0", active && "text-primary")} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      {!sidebarCollapsed && item.hint && (
                        <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 h-3.5 text-primary/80 border-primary/30">
                          {item.hint}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t p-2.5 shrink-0">
        <div className={cn("flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-sidebar-accent/60 transition-colors cursor-pointer", sidebarCollapsed && "justify-center")}>
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && me && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate leading-tight">{me.user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground truncate">
                  Lvl {me.gamification.level} · {levelTitle(me.gamification.level)}
                </span>
              </div>
            </div>
          )}
          {!sidebarCollapsed && me && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                <Flame className="w-2.5 h-2.5" />
                {me.gamification.currentStreak}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-primary font-medium">
                <Sparkles className="w-2.5 h-2.5" />
                {me.gamification.totalXP >= 1000 ? `${(me.gamification.totalXP / 1000).toFixed(1)}k` : me.gamification.totalXP}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
