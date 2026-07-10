"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Footer } from "@/components/footer";
import { CommandPalette } from "@/components/command-palette";
import { DashboardView } from "@/components/views/dashboard-view";
import { LearnView } from "@/components/views/learn-view";
import { TutorView } from "@/components/views/tutor-view";
import { QuizzesView } from "@/components/views/quizzes-view";
import { FlashcardsView } from "@/components/views/flashcards-view";
import { FocusView } from "@/components/views/focus-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { GamificationView } from "@/components/views/gamification-view";
import { KnowledgeView } from "@/components/views/knowledge-view";
import { DocumentsView } from "@/components/views/documents-view";
import { ClassroomView } from "@/components/views/classroom-view";
import { SettingsView } from "@/components/views/settings-view";
import { LessonStudioView } from "@/components/views/lesson-studio-view";
import { MobileNav } from "@/components/mobile-nav";
import { useAtmosphere, StarField } from "@/lib/atmosphere";
import { Loader2, Brain } from "lucide-react";
import { motion } from "framer-motion";

export function AppShell() {
  const { me, authLoading, loadMe, view, viewParams, commandOpen } = useAppStore();
  const atmosphere = useAtmosphere();

  useEffect(() => {
    if (!me && authLoading) {
      loadMe();
    }
  }, [me, authLoading, loadMe]);

  // Global keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useAppStore.getState().setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </motion.div>
          <p className="text-xs text-muted-foreground">Loading NeuroLearn…</p>
        </div>
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden" style={{ backgroundImage: atmosphere.bgGradient }}>
      <div className="gradient-mesh absolute inset-0 opacity-50 pointer-events-none" />
      <div className="orb" style={{ width: 420, height: 420, left: -80, top: -60, background: "linear-gradient(180deg, rgba(123,97,255,0.18), rgba(255,144,123,0.12))" }} />
      <div className="orb" style={{ width: 320, height: 320, right: -60, bottom: -80, background: "linear-gradient(180deg, rgba(96,255,176,0.12), rgba(123,97,255,0.12))" }} />
      {/* Stars at night */}
      {atmosphere.showStars && <StarField count={15} />}
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Topbar />
        <main className={`flex-1 overflow-x-hidden ${view === "tutor" ? "p-0" : "p-4 lg:p-6"} pb-20 lg:pb-6`}>
          <motion.div
            key={view + JSON.stringify(viewParams)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {view === "dashboard" && <DashboardView />}
            {view === "learn" && <LearnView />}
            {view === "tutor" && <TutorView />}
            {view === "analytics" && <AnalyticsView />}
            {view === "settings" && <SettingsView />}
            {view === "lesson-studio" && <LessonStudioView />}
            {/* Sub-views accessible via navigation but not in main sidebar */}
            {view === "quizzes" && <QuizzesView />}
            {view === "flashcards" && <FlashcardsView />}
            {view === "focus" && <FocusView />}
            {view === "knowledge" && <KnowledgeView />}
            {view === "gamification" && <GamificationView />}
            {view === "documents" && <DocumentsView />}
            {view === "classroom" && <ClassroomView />}
          </motion.div>
        </main>
        {view !== "tutor" && <Footer />}
      </div>
      <MobileNav />
      {commandOpen && <CommandPalette />}
    </div>
  );
}
