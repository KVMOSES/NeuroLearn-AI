"use client";

import { create } from "zustand";
import { api } from "@/lib/api-client";
import type { MeResponse, ViewKey } from "@/lib/types";

interface AppState {
  // Auth
  me: MeResponse | null;
  authLoading: boolean;
  authError: string | null;
  loadMe: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;

  // Navigation
  view: ViewKey;
  viewParams: Record<string, unknown>;
  setView: (v: ViewKey, params?: Record<string, unknown>) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  // Command palette
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  toggleCommand: () => void;

  // Global search modal
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  me: null,
  authLoading: true,
  authError: null,

  loadMe: async () => {
    set({ authLoading: true, authError: null });
    try {
      const data = await api.get<MeResponse>("/api/auth/me");
      set({ me: data, authLoading: false });
    } catch {
      set({ me: null, authLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore
    }
    set({ me: null, view: "dashboard" });
  },

  clearAuth: () => set({ me: null }),

  view: "dashboard",
  viewParams: {},
  setView: (v, params = {}) => set({ view: v, viewParams: params }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),

  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),
}));
