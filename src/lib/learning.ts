/**
 * NeuroLearn AI — core domain algorithms
 * Implements real Bayesian Knowledge Tracing (BKT) and SM-2 spaced repetition.
 */

// ============================================================
// BAYESIAN KNOWLEDGE TRACING
// ============================================================

export interface BKTParams {
  pKnown: number; // P(L_n) prior probability the skill is known
  pTransit: number; // P(T) transition (learn) probability
  pSlip: number; // P(S) slip probability (knows but answers wrong)
  pGuess: number; // P(G) guess probability (doesn't know but answers right)
}

export const DEFAULT_BKT: BKTParams = {
  pKnown: 0.5,
  pTransit: 0.1,
  pSlip: 0.1,
  pGuess: 0.25,
};

const clamp = (v: number, lo = 0.0001, hi = 0.9999) => Math.max(lo, Math.min(hi, v));

/**
 * Update BKT state after observing a response.
 * Returns posterior P(known) including transition learning.
 */
export function updateBKT(params: BKTParams, correct: boolean): BKTParams {
  const { pKnown, pTransit, pSlip, pGuess } = params;

  // P(correct) marginal
  const pCorrect = pKnown * (1 - pSlip) + (1 - pKnown) * pGuess;

  // Posterior P(known | observation)
  let posterior: number;
  if (correct) {
    posterior = (pKnown * (1 - pSlip)) / pCorrect;
  } else {
    const pIncorrect = 1 - pCorrect;
    posterior = (pKnown * pSlip) / (pIncorrect || 0.0001);
  }
  posterior = clamp(posterior);

  // Apply transition (learning)
  const newPKnown = posterior + (1 - posterior) * pTransit;

  return {
    pKnown: clamp(newPKnown),
    pTransit,
    pSlip,
    pGuess,
  };
}

/**
 * Predict exam readiness as weighted mastery across skills.
 */
export function examReadiness(masteryValues: number[]): number {
  if (masteryValues.length === 0) return 0;
  // Weight harder-to-master skills slightly more (diminishing mean)
  const sorted = [...masteryValues].sort((a, b) => a - b);
  const weighted = sorted.map((v, i) => v * (1 + (i / sorted.length) * 0.2));
  const sumW = sorted.map((_, i) => 1 + (i / sorted.length) * 0.2).reduce((a, b) => a + b, 0);
  return weighted.reduce((a, b) => a + b, 0) / sumW;
}

// ============================================================
// SM-2 SPACED REPETITION
// ============================================================

export interface SM2State {
  repetitions: number;
  interval: number; // days
  easeFactor: number;
}

export const DEFAULT_SM2: SM2State = {
  repetitions: 0,
  interval: 0,
  easeFactor: 2.5,
};

/**
 * Update SM-2 spaced repetition state from a review quality (0..5).
 * 5=perfect, 4=correct w/ hesitation, 3=correct w/ difficulty,
 * 2=incorrect but easy recall, 1=incorrect, some recognition, 0=blackout
 */
export function updateSM2(state: SM2State, quality: number): SM2State {
  const q = clamp(Math.round(quality), 0, 5);
  let { repetitions, interval, easeFactor } = state;

  if (q >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  return { repetitions, interval, easeFactor };
}

export function nextReviewDate(intervalDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, intervalDays));
  return d;
}

// ============================================================
// XP & LEVELING
// ============================================================

// XP required to reach a given level (cumulative). Level 1 = 0 XP.
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Triangular growth: L1->0, L2->100, L3->300, L4->600 ... level L requires 100*(L-1)*L/2
  return 50 * (level - 1) * level;
}

export function levelForXP(totalXP: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXP) level++;
  return level;
}

export function levelProgress(totalXP: number): {
  level: number;
  current: number;
  needed: number;
  pct: number;
} {
  const level = levelForXP(totalXP);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const current = totalXP - base;
  const needed = next - base;
  const pct = needed > 0 ? (current / needed) * 100 : 100;
  return { level, current, needed, pct };
}

export const XP_REWARDS = {
  lesson_complete: 50,
  quiz_pass: 80,
  quiz_perfect: 150,
  flashcard_review: 8,
  flashcard_streak_bonus: 20,
  streak_bonus: 25,
  achievement: 0, // varies
  chat_message: 2,
  document_upload: 15,
} as const;

export type XpReason = keyof typeof XP_REWARDS;

// ============================================================
// ADAPTIVE QUIZ DIFFICULTY
// ============================================================

/**
 * Select next question difficulty based on current mastery estimate.
 * Returns target difficulty 0..1.
 */
export function nextDifficulty(mastery: number, recentCorrectRate: number): number {
  // If mastery is high and recent accuracy high, ramp up difficulty.
  // If struggling, ease off.
  const target = 0.3 + mastery * 0.6; // 0.3..0.9
  const adjustment = (recentCorrectRate - 0.7) * 0.15; // small nudge
  return clamp(target + adjustment, 0.1, 0.95);
}

/**
 * Pick the closest question to a target difficulty from a pool.
 */
export function pickAdaptiveQuestion<T extends { difficulty: number }>(
  pool: T[],
  target: number,
  excludeIds: Set<string>,
  getId: (q: T) => string
): T | undefined {
  const available = pool.filter((q) => !excludeIds.has(getId(q)));
  if (available.length === 0) return undefined;
  let best = available[0];
  let bestDist = Math.abs(best.difficulty - target);
  for (const q of available) {
    const d = Math.abs(q.difficulty - target);
    if (d < bestDist) {
      best = q;
      bestDist = d;
    }
  }
  return best;
}

// ============================================================
// COSINE SIMILARITY (for RAG retrieval)
// ============================================================

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Deterministic pseudo-embedding from text (hash-based bag of tokens).
 * Used to simulate semantic embeddings without an external model.
 */
export function pseudoEmbed(text: string, dims = 64): number[] {
  const vec = new Array(dims).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    let h = 0;
    for (let i = 0; i < t.length; i++) {
      h = (h * 31 + t.charCodeAt(i)) >>> 0;
    }
    vec[h % dims] += 1;
  }
  // L2 normalize
  const mag = Math.sqrt(vec.reduce((a, b) => a + b * b, 0));
  if (mag > 0) {
    for (let i = 0; i < dims; i++) vec[i] /= mag;
  }
  return vec;
}
