"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { AuthView } from "@/components/auth-view";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  const { me, authLoading, loadMe } = useAppStore();

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  if (authLoading && !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/25"
          >
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </motion.div>
          <p className="text-xs text-muted-foreground">Loading NeuroLearn AI…</p>
        </div>
      </div>
    );
  }

  if (!me) return <AuthView />;

  return <AppShell />;
}
