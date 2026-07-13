"use client";

import { Brain, Github, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t glass-card" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
      <div className="px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-gradient-to-br from-primary to-primary flex items-center justify-center">
            <Brain className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="font-medium">NeuroLearn AI</span>
          <span className="opacity-50">·</span>
          <span className="opacity-70">Adaptive Learning Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <span>v2.0</span>
          <span className="hidden sm:inline opacity-60">SOC2 · GDPR · FERPA Ready</span>
          <span className="flex items-center gap-1">
            Built with <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" /> for learners
          </span>
        </div>
      </div>
    </footer>
  );
}
