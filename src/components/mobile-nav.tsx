"use client";

import { Home, GraduationCap, Bot, BarChart3, MoreHorizontal } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { ViewKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Sparkles, Settings, Layers, Timer, ListChecks, FileText } from "lucide-react";

const BOTTOM_NAV: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: "dashboard", label: "Home", icon: Home },
  { key: "learn", label: "Learn", icon: GraduationCap },
  { key: "tutor", label: "AI Tutor", icon: Bot },
  { key: "analytics", label: "Progress", icon: BarChart3 },
];

const MORE_ITEMS: { key: ViewKey; label: string; icon: any }[] = [
  { key: "lesson-studio", label: "Lesson Studio", icon: Sparkles },
  { key: "quizzes", label: "Quizzes", icon: ListChecks },
  { key: "flashcards", label: "Flashcards", icon: Layers },
  { key: "focus", label: "Focus Timer", icon: Timer },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const { view, setView } = useAppStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_ITEMS.some((item) => item.key === view);

  function navigate(v: ViewKey) {
    setView(v);
    setMoreOpen(false);
  }

  return (
    <>
      {/* Bottom navigation — mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t">
        <div className="flex items-center justify-around h-14 px-2 safe-area-pb">
          {BOTTOM_NAV.map((item) => {
            const active = view === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
              >
                {active && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
                  />
                )}
                <Icon className={cn("w-5 h-5 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-[9px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </button>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
          >
            {isMoreActive && (
              <motion.div
                layoutId="bottom-nav-active"
                className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
              />
            )}
            <MoreHorizontal className={cn("w-5 h-5 transition-colors", isMoreActive ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-[9px] font-medium transition-colors", isMoreActive ? "text-primary" : "text-muted-foreground")}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-center">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", active ? "bg-primary/10" : "bg-muted")}>
                    <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
