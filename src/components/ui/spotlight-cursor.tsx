"use client";

import { useEffect, useRef } from "react";

/**
 * A fixed-position radial glow that follows the mouse pointer.
 * Purely decorative — pointer events pass through.
 * Only active on fine-pointer devices (hidden on touch via CSS @media pointer: coarse).
 */
export function SpotlightCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion and coarse-pointer devices
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(pointer: coarse)");
    if (mql.matches || pointer.matches) return;

    function onMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty("--spot-x", `${e.clientX}px`);
      el.style.setProperty("--spot-y", `${e.clientY}px`);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return <div ref={ref} className="spotlight-layer" aria-hidden="true" />;
}
