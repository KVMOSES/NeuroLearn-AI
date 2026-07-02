"use client";

import { motion } from "framer-motion";

/**
 * Skeleton loader — prevents layout shift during async loads.
 * Uses a subtle shimmer animation.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-muted/60 ${className}`}
      style={{
        background: "linear-gradient(90deg, var(--muted) 0%, color-mix(in oklch, var(--muted) 50%, transparent) 50%, var(--muted) 100%)",
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.5s infinite",
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Hero skeleton */}
      <div className="rounded-3xl border border-border/50 p-8 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="w-14 h-14 rounded-2xl" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>

      {/* Mission skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/50 p-3 flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Continue learning skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 p-3 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TutorSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {[1, 2].map((i) => (
        <div key={i} className={`flex gap-3 ${i === 2 ? "flex-row-reverse" : ""}`}>
          <Skeleton className="w-9 h-9 rounded-2xl shrink-0" />
          <div className="max-w-[80%] space-y-2">
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuizSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="rounded-xl border p-6 space-y-4">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LearnSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border overflow-hidden">
            <Skeleton className="h-24 w-full" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
