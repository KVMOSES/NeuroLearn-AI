"use client";

/**
 * AICompanion — NeuroLearn's premium 3D AI learning assistant.
 *
 * A balanced character (not a floating blob): a soft rounded head (neither a
 * perfect circle nor a square), a compact torso with subtle shoulders, and
 * small floating arms. Smooth white Apple-inspired 3D surfaces, soft blue and
 * purple accent lighting, expressive glowing cyan eyes, a warm smile, and
 * product-render shading. Its signature element is a slowly orbiting knowledge
 * ring — a minimal, premium halo that makes it instantly recognizable as
 * NeuroLearn's companion. No helmet, visor, mask, faceplate, ghost, marshmallow,
 * emoji, or alien styling. Floating, glow, and transparency are handled by the
 * parent CompanionAvatar wrapper.
 */

const SIZES: Record<string, string> = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
  "2xl": "w-[8.5rem] h-[8.5rem]",
};

export function AICompanion({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZES | string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 240"
      className={`${SIZES[size] ?? "w-10 h-10"} ${className}`}
      style={{ filter: "drop-shadow(0 12px 26px rgba(124,97,255,0.30))" }}
      aria-label="NeuroLearn AI Companion"
    >
      <defs>
        <radialGradient id="acBody" cx="40%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="58%" stopColor="#f6f7ff" />
          <stop offset="100%" stopColor="#e6e8fb" />
        </radialGradient>
        <linearGradient id="acSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="acAura" cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.30" />
          <stop offset="60%" stopColor="#60a5fa" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="acShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#312e81" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="acRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id="acEye" cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#e0fbff" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id="acEyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft blue/purple ambient aura */}
      <circle cx="100" cy="120" r="94" fill="url(#acAura)" />

      {/* Signature — slowly orbiting knowledge ring (halo) */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 100 120"
          to="360 100 120"
          dur="22s"
          repeatCount="indefinite"
        />
        <ellipse cx="100" cy="120" rx="76" ry="30" fill="none" stroke="url(#acRing)" strokeWidth="3" opacity="0.7" />
        <circle cx="176" cy="120" r="4.5" fill="#22d3ee" opacity="0.9" />
      </g>

      {/* Gentle floating shadow */}
      <ellipse cx="100" cy="226" rx="38" ry="7" fill="url(#acShadow)" />

      {/* Arms — small floating capsules at the sides */}
      <ellipse cx="44" cy="160" rx="9" ry="16" fill="url(#acBody)" stroke="#dfe2f5" strokeWidth="1.2" transform="rotate(-12 44 160)" />
      <ellipse cx="156" cy="160" rx="9" ry="16" fill="url(#acBody)" stroke="#dfe2f5" strokeWidth="1.2" transform="rotate(12 156 160)" />

      {/* Torso — compact body with subtle shoulders */}
      <path
        d="M66,132
           C62,150 66,178 82,194
           C90,201 110,201 118,194
           C134,178 138,150 134,132
           C128,124 116,122 100,122
           C84,122 72,124 66,132 Z"
        fill="url(#acBody)"
        stroke="#dfe2f5"
        strokeWidth="1.5"
      />
      {/* Torso ambient occlusion + sheen */}
      <ellipse cx="100" cy="190" rx="26" ry="12" fill="#312e81" opacity="0.05" />
      <path d="M74,134 Q80,126 100,126 Q88,132 86,146 Q78,144 74,134 Z" fill="url(#acSheen)" />
      {/* Soft blue / purple accent rim lighting */}
      <path d="M66,134 C62,152 66,178 80,192" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" opacity="0.20" />
      <path d="M134,134 C138,152 134,178 120,192" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" opacity="0.18" />

      {/* Head — soft rounded (neither circle nor square) */}
      <rect x="62" y="32" width="76" height="88" rx="34" ry="34" fill="url(#acBody)" stroke="#dfe2f5" strokeWidth="1.5" />
      {/* Head ambient occlusion + sheen */}
      <ellipse cx="100" cy="106" rx="32" ry="16" fill="#312e81" opacity="0.05" />
      <path d="M72,52 Q78,38 104,38 Q84,46 80,66 Q72,64 72,52 Z" fill="url(#acSheen)" />

      {/* Eyes — expressive, glowing cyan */}
      <circle cx="76" cy="84" r="18" fill="url(#acEyeGlow)" />
      <circle cx="124" cy="84" r="18" fill="url(#acEyeGlow)" />
      <ellipse cx="76" cy="86" rx="13" ry="14" fill="url(#acEye)" />
      <ellipse cx="124" cy="86" rx="13" ry="14" fill="url(#acEye)" />
      <circle cx="71" cy="80" r="4.5" fill="#ffffff" opacity="0.95" />
      <circle cx="119" cy="80" r="4.5" fill="#ffffff" opacity="0.95" />

      {/* Soft blush */}
      <ellipse cx="58" cy="100" rx="8" ry="4.5" fill="#fbcfe8" opacity="0.5" />
      <ellipse cx="142" cy="100" rx="8" ry="4.5" fill="#c7d2fe" opacity="0.45" />

      {/* Warm smile */}
      <path d="M82,102 Q100,118 118,102" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
