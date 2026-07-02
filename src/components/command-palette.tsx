"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, FileText, MessageSquare, BookOpen, Layers, ListChecks, Share2,
  GraduationCap, ArrowRight, CornerDownLeft, Command, Bot, BarChart3, Settings, Sparkles,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api-client";
import type { SearchResult, ViewKey } from "@/lib/types";
import {
  Dialog, DialogContent, DialogHeader,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_COMMANDS: { label: string; hint: string; view: ViewKey; icon: any; keywords: string }[] = [
  { label: "Home", hint: "Your study space", view: "dashboard", icon: GraduationCap, keywords: "home overview today mission" },
  { label: "Learn", hint: "Materials & lessons", view: "learn", icon: BookOpen, keywords: "lessons modules learn documents upload" },
  { label: "AI Tutor", hint: "Your personal mentor", view: "tutor", icon: Bot, keywords: "chat ai rag assistant teacher mentor" },
  { label: "Lesson Studio", hint: "Generate presentations, notes, courses", view: "lesson-studio", icon: Sparkles, keywords: "presentation notes cheatsheet mindmap course summary export pptx pdf" },
  { label: "Progress", hint: "Analytics & achievements", view: "analytics", icon: BarChart3, keywords: "stats charts analytics achievements xp knowledge graph" },
  { label: "Settings", hint: "Account & preferences", view: "settings", icon: Settings, keywords: "profile theme account" },
];

const TYPE_ICON: Record<string, any> = {
  document: FileText,
  conversation: MessageSquare,
  flashcard: Layers,
  lesson: BookOpen,
  quiz: ListChecks,
  course: GraduationCap,
  skill: Share2,
};

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setView, view } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!commandOpen) {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [commandOpen]);

  // Debounced global search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const d = await api.get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`);
        setResults(d.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const navMatches = useMemo(() => {
    if (!query.trim()) return NAV_COMMANDS;
    const q = query.toLowerCase();
    return NAV_COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q) || c.hint.toLowerCase().includes(q)
    );
  }, [query]);

  const all = useMemo(() => {
    const navItems = navMatches.map((n) => ({
      kind: "nav" as const,
      id: `nav-${n.view}`,
      label: n.label,
      hint: n.hint,
      icon: n.icon,
      view: n.view,
    }));
    const searchItems = results.map((r) => ({
      kind: "result" as const,
      id: `${r.type}-${r.id}`,
      label: r.title,
      hint: r.snippet,
      icon: TYPE_ICON[r.type] ?? FileText,
      view: r.url as ViewKey,
      meta: r.meta,
    }));
    return [...navItems, ...searchItems];
  }, [navMatches, results]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function execute(item: typeof all[number] | undefined) {
    if (!item) return;
    setView(item.view);
    setCommandOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, all.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      execute(all[active]);
    } else if (e.key === "Escape") {
      setCommandOpen(false);
    }
  }

  return (
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden border-border/60 shadow-elevated" onKeyDown={onKeyDown}>
        <DialogHeader className="sr-only">
          <h2 className="text-lg font-semibold">Command Palette</h2>
        </DialogHeader>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to anything…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-medium text-muted-foreground border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto scrollbar-thin py-2">
          {!query.trim() && (
            <div className="px-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Navigation</p>
              {all.map((item, i) => (
                <PaletteRow key={item.id} item={item} active={i === active} onClick={() => execute(item)} onHover={() => setActive(i)} />
              ))}
            </div>
          )}

          {query.trim() && navMatches.length > 0 && (
            <div className="px-2 mb-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pages</p>
              {navMatches.map((n, i) => {
                const item = { kind: "nav" as const, id: `nav-${n.view}`, label: n.label, hint: n.hint, icon: n.icon, view: n.view };
                return <PaletteRow key={item.id} item={item} active={i === active} onClick={() => execute(item)} onHover={() => setActive(i)} />;
              })}
            </div>
          )}

          {query.trim() && (
            <div className="px-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {searching ? "Searching…" : `Results (${results.length})`}
              </p>
              {results.length === 0 && !searching && (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">No matches found.</p>
              )}
              {results.map((r, i) => {
                const idx = navMatches.length + i;
                const item = { kind: "result" as const, id: `${r.type}-${r.id}`, label: r.title, hint: r.snippet, icon: TYPE_ICON[r.type] ?? FileText, view: r.url as ViewKey, meta: r.meta };
                return <PaletteRow key={item.id} item={item} active={idx === active} onClick={() => execute(item)} onHover={() => setActive(idx)} />;
              })}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="border rounded px-1 py-0.5">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="border rounded px-1 py-0.5">↵</kbd> select</span>
          </div>
          <span className="flex items-center gap-1"><Command className="w-3 h-3" /> NeuroLearn AI</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaletteRow({
  item,
  active,
  onClick,
  onHover,
}: {
  item: { kind: string; id: string; label: string; hint: string; icon: any; view: ViewKey; meta?: Record<string, string> };
  active: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onMouseMove={onHover}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
      )}
    >
      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", active ? "bg-primary/15" : "bg-muted")}>
        <Icon className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.hint}</p>
      </div>
      {item.kind === "nav" ? (
        <ArrowRight className={cn("w-3.5 h-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/60")} />
      ) : (
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">{item.meta?.type ?? item.kind}</span>
      )}
    </button>
  );
}
