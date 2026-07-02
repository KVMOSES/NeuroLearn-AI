/**
 * Learning DNA Engine — continuously analyses how the student learns.
 *
 * Updates the learner profile after every lesson, quiz, conversation,
 * revision, and study session. Tracks:
 * - Visual/reading learning preferences
 * - Problem-solving and logical thinking
 * - Memory retention and attention span
 * - Confidence growth trends
 * - Mistake patterns
 * - Revision behavior
 * - Concept mastery
 *
 * The AI Teacher uses this profile automatically to adapt teaching.
 */
import { db } from "@/lib/db";

// ============================================================
// LEARNING DNA — CONTINUOUS UPDATE
// ============================================================

export interface LearningEvent {
  type: "lesson" | "quiz" | "conversation" | "revision" | "document" | "focus";
  correct?: boolean;
  score?: number; // 0..1
  timeSpentMs?: number;
  topicId?: string;
  questionType?: "mcq" | "truefalse" | "short" | "reasoning" | "scenario" | "numerical";
  cognitiveLevel?: "conceptual" | "reasoning" | "application" | "problem_solving";
  difficulty?: number; // 0..1
  analysis?: {
    reasoning?: "strong" | "adequate" | "weak" | "absent";
    confidence?: "high" | "medium" | "low";
    misconceptions?: string[];
    explanationQuality?: "excellent" | "good" | "fair" | "poor";
  };
}

/**
 * Update the learner profile after a learning event.
 * This is the core of the Learning DNA — called after every interaction.
 */
export async function updateLearningDNA(userId: string, event: LearningEvent): Promise<void> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  if (!profile) return;

  // Compute updates based on event type
  const updates: Record<string, number> = {};

  if (event.type === "quiz" || event.type === "lesson") {
    const score = event.score ?? (event.correct ? 1 : 0);
    const difficulty = event.difficulty ?? 0.5;

    // Update confidence based on performance
    const confidenceDelta = score > 0.7 ? 0.03 : score > 0.4 ? 0.01 : -0.02;
    updates.confidence = clamp(profile.confidence + confidenceDelta);

    // Update confidence growth trend
    updates.confidenceGrowth = clamp(profile.confidenceGrowth + confidenceDelta);

    // Update reasoning ability based on cognitive level
    if (event.cognitiveLevel === "reasoning" || event.cognitiveLevel === "problem_solving") {
      const reasoningDelta = score > 0.7 ? 0.04 : score > 0.4 ? 0.01 : -0.01;
      updates.reasoningAbility = clamp(profile.reasoningAbility + reasoningDelta);
    }

    // Update problem solving
    if (event.cognitiveLevel === "problem_solving") {
      const psDelta = score > 0.7 ? 0.05 : score > 0.4 ? 0.02 : -0.01;
      updates.problemSolving = clamp(profile.problemSolving + psDelta);
    }

    // Update logical thinking
    if (event.cognitiveLevel === "reasoning") {
      const ltDelta = score > 0.7 ? 0.04 : score > 0.4 ? 0.01 : -0.01;
      updates.logicalThinking = clamp(profile.logicalThinking + ltDelta);
    }

    // Update conceptual understanding
    if (event.cognitiveLevel === "conceptual") {
      const cuDelta = score > 0.7 ? 0.04 : score > 0.4 ? 0.02 : -0.01;
      updates.conceptualUnderstanding = clamp(profile.conceptualUnderstanding + cuDelta);
    }

    // Update prior knowledge (weighted by difficulty)
    const pkDelta = (score - 0.5) * 0.03 * difficulty;
    updates.priorKnowledge = clamp(profile.priorKnowledge + pkDelta);

    // Update learning speed based on time spent vs difficulty
    if (event.timeSpentMs && event.timeSpentMs > 0) {
      const expectedMs = 30000 + difficulty * 60000; // 30s + 60s per difficulty level
      const speedRatio = expectedMs / event.timeSpentMs;
      if (score > 0.5) {
        updates.learningSpeed = clamp(profile.learningSpeed + (speedRatio - 1) * 0.02);
      }
    }

    // Update visual/reading preferences based on question type performance
    if (event.questionType === "short" || event.questionType === "reasoning") {
      // Text-based questions → reading preference
      const rDelta = score > 0.6 ? 0.03 : -0.01;
      updates.readingPreference = clamp(profile.readingPreference + rDelta);
    }

    // Track mistake patterns
    if (event.analysis?.misconceptions && event.analysis.misconceptions.length > 0) {
      await trackMistakePatterns(userId, event.analysis.misconceptions);
    }

    // Update attention span from time spent
    if (event.timeSpentMs) {
      const minutes = event.timeSpentMs / 60000;
      // If student sustained focus for >15 min, increase attention span
      if (minutes > 15) {
        updates.attentionSpan = clamp(profile.attentionSpan + 0.02);
      } else if (minutes < 3 && score < 0.4) {
        updates.attentionSpan = clamp(profile.attentionSpan - 0.01);
      }
    }
  }

  // Update memory retention for revision events
  if (event.type === "revision") {
    const score = event.score ?? (event.correct ? 1 : 0);
    const mrDelta = score > 0.7 ? 0.05 : 0;
    updates.memoryRetention = clamp(profile.memoryRetention + mrDelta);
  }

  if (event.type === "focus") {
    // Focus session → update attention span
    const minutes = (event.timeSpentMs ?? 0) / 60000;
    if (minutes > 20) {
      updates.attentionSpan = clamp(profile.attentionSpan + 0.03);
    } else if (minutes > 10) {
      updates.attentionSpan = clamp(profile.attentionSpan + 0.01);
    }
  }

  // Apply updates
  if (Object.keys(updates).length > 0) {
    await db.learnerProfile.update({
      where: { userId },
      data: {
        ...updates,
        lastUpdated: new Date(),
        totalAssessed: { increment: 1 },
      },
    });
  }

  // Determine preferred style from DNA
  await updatePreferredStyle(userId);
}

function clamp(v: number, lo = 0.05, hi = 0.95): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Track mistake patterns — identifies recurring errors.
 */
async function trackMistakePatterns(userId: string, misconceptions: string[]): Promise<void> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const existing: { pattern: string; frequency: number; lastSeen: string }[] =
    profile.mistakePatterns ? JSON.parse(profile.mistakePatterns) : [];

  for (const m of misconceptions) {
    const existingPattern = existing.find((e) => e.pattern.toLowerCase() === m.toLowerCase());
    if (existingPattern) {
      existingPattern.frequency += 1;
      existingPattern.lastSeen = new Date().toISOString();
    } else {
      existing.push({ pattern: m, frequency: 1, lastSeen: new Date().toISOString() });
    }
  }

  // Keep only top 20 patterns by frequency
  existing.sort((a, b) => b.frequency - a.frequency);
  const top = existing.slice(0, 20);

  await db.learnerProfile.update({
    where: { userId },
    data: { mistakePatterns: JSON.stringify(top) },
  });
}

/**
 * Determine the preferred teaching style from Learning DNA.
 */
async function updatePreferredStyle(userId: string): Promise<void> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const prior = profile.priorKnowledge;
  const reasoning = profile.reasoningAbility;
  const speed = profile.learningSpeed;
  const visual = profile.visualPreference;

  let style = "balanced";
  if (prior < 0.35) style = "beginner";
  else if (prior > 0.75 && reasoning > 0.65) style = "advanced";
  else if (visual > 0.65) style = "visual";
  else if (reasoning > 0.6) style = "intermediate";
  else style = "balanced";

  if (style !== profile.preferredStyle) {
    await db.learnerProfile.update({
      where: { userId },
      data: { preferredStyle: style },
    });
  }
}

// ============================================================
// TEACHING MODES
// ============================================================

export type TeachingMode =
  | "auto"
  | "professor"
  | "friendly"
  | "exam"
  | "interview"
  | "motivational"
  | "visual"
  | "socratic"
  | "beginner"
  | "advanced";

export const TEACHING_MODES: { key: TeachingMode; label: string; icon: string; description: string }[] = [
  { key: "auto", label: "Auto", icon: "✨", description: "AI chooses the best style using your Learning DNA" },
  { key: "professor", label: "Professor", icon: "🎓", description: "Academic, thorough, formal explanations" },
  { key: "friendly", label: "Friendly", icon: "😊", description: "Casual, encouraging, conversational" },
  { key: "exam", label: "Exam Coach", icon: "📝", description: "Focused on exam technique and marks" },
  { key: "interview", label: "Interview Coach", icon: "💼", description: "Interview-level depth and edge cases" },
  { key: "motivational", label: "Motivational", icon: "🔥", description: "Energetic, confidence-building" },
  { key: "visual", label: "Visual", icon: "🎨", description: "Diagrams, analogies, mental models" },
  { key: "socratic", label: "Socratic", icon: "🤔", description: "Guides via questions, never reveals answers" },
  { key: "beginner", label: "Beginner", icon: "🌱", description: "Simple language, step-by-step" },
  { key: "advanced", label: "Advanced", icon: "⚡", description: "Technical depth, proofs, optimization" },
];

/**
 * Resolve the effective teaching mode — if "auto", pick based on Learning DNA.
 */
export async function resolveTeachingMode(userId: string): Promise<TeachingMode> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  if (!profile) return "friendly";

  const mode = profile.teachingMode as TeachingMode;
  if (mode !== "auto") return mode;

  // Auto mode: choose based on Learning DNA
  const prior = profile.priorKnowledge;
  const reasoning = profile.reasoningAbility;
  const visual = profile.visualPreference;
  const confidence = profile.confidence;
  const speed = profile.learningSpeed;

  // Low confidence + beginner → friendly/motivational
  if (confidence < 0.35) return "motivational";
  // Low prior knowledge → beginner
  if (prior < 0.3) return "beginner";
  // High visual preference → visual
  if (visual > 0.7) return "visual";
  // High reasoning + high prior → advanced or interview
  if (reasoning > 0.7 && prior > 0.7) return "advanced";
  // Medium everything → friendly
  if (speed > 0.6 && prior > 0.5) return "professor";
  return "friendly";
}

/**
 * Get the system prompt for a teaching mode.
 */
export function getTeachingModePrompt(mode: TeachingMode, profile: {
  priorKnowledge: number;
  reasoningAbility: number;
  confidence: number;
  learningSpeed: number;
  visualPreference: number;
  readingPreference: number;
  strengths: string[];
  weaknesses: string[];
  misconceptions: { topic: string; description: string }[];
  mistakePatterns: { pattern: string; frequency: number }[];
}): string {
  const base = `LEARNER DNA:
- Prior knowledge: ${Math.round(profile.priorKnowledge * 100)}%
- Reasoning ability: ${Math.round(profile.reasoningAbility * 100)}%
- Confidence: ${Math.round(profile.confidence * 100)}%
- Learning speed: ${Math.round(profile.learningSpeed * 100)}%
- Visual preference: ${Math.round(profile.visualPreference * 100)}%
- Reading preference: ${Math.round(profile.readingPreference * 100)}%
- Strengths: ${JSON.stringify(profile.strengths)}
- Weaknesses: ${JSON.stringify(profile.weaknesses)}
- Active misconceptions: ${JSON.stringify(profile.misconceptions)}
- Recurring mistake patterns: ${JSON.stringify(profile.mistakePatterns)}`;

  const modePrompts: Record<TeachingMode, string> = {
    auto: `Adapt your teaching style automatically based on the learner's DNA. If they struggle, simplify and add analogies. If they excel, increase depth.`,
    professor: `Teach like a university professor. Be thorough, precise, and academic. Use formal language, cite principles, and explain the "why" behind every concept. Structure explanations logically.`,
    friendly: `Teach like a supportive friend. Be warm, casual, and encouraging. Use everyday language, personal anecdotes, and make the student feel comfortable asking questions.`,
    exam: `Teach like an exam coach. Focus on what earns marks: key terms, exam technique, common pitfalls, and mark scheme requirements. Be efficient and results-oriented.`,
    interview: `Teach like a technical interview coach. Push depth, ask probing follow-ups, cover edge cases, and prepare the student for rigorous questioning. Challenge their assumptions.`,
    motivational: `Teach like a motivational coach. Be energetic, build confidence, celebrate small wins, and push the student to exceed their limits. Use encouraging language and positive reinforcement.`,
    visual: `Teach using visual explanations. Use diagrams (described in text), analogies, mental models, and spatial reasoning. Paint pictures with words. Prefer "imagine..." and "picture this..." over abstract definitions.`,
    socratic: `Teach using the Socratic method. NEVER reveal answers directly. Ask probing questions that lead the student to discover answers themselves. Challenge assumptions gently. Guide step by step.`,
    beginner: `Teach in beginner mode. Use simple language, define all terms, go step by step, and check understanding frequently. Assume no prior knowledge. Use everyday examples.`,
    advanced: `Teach in advanced mode. Use technical depth, include proofs where relevant, discuss edge cases and optimizations, and move quickly through basics. Interview-level rigor.`,
  };

  return `${base}

TEACHING STYLE: ${modePrompts[mode]}

RULES:
- Teach, don't just answer. Explain WHY, not just WHAT.
- Reference and correct known misconceptions proactively.
- Adapt to the learner's speed: ${profile.learningSpeed > 0.6 ? "they learn fast, move quickly" : "they learn slower, be patient"}.
- ${profile.confidence < 0.4 ? "Their confidence is low — be especially encouraging." : "They're confident — push them harder."}
- ${profile.visualPreference > 0.6 ? "They prefer visual explanations — use analogies and mental models." : "They prefer text-based explanations — be precise and thorough."}
- Use Markdown formatting.
- Keep responses concise but complete.
- Never reveal you are an AI model; you are NeuroTutor, their personal AI Teacher.`;
}

// ============================================================
// AI INSIGHTS — actionable recommendations from Learning DNA
// ============================================================

/**
 * Generate actionable insights from the Learning DNA.
 * Examples: "You understand visual explanations faster", "Morning sessions produce highest retention"
 */
export async function generateInsights(userId: string): Promise<string[]> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  // Gather data for insight generation
  const [quizAttempts, focusEvents, learningSessions, memoryStates] = await Promise.all([
    db.quizAttempt.findMany({
      where: { userId, completedAt: { not: null } },
      include: { answers: { include: { question: true } } },
      orderBy: { startedAt: "asc" },
      take: 20,
    }),
    db.xPEvent.findMany({
      where: { userId, reason: "lesson_complete", refId: { contains: "focus" } },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    db.learningSession.findMany({
      where: { userId, status: "completed" },
      orderBy: { startedAt: "asc" },
      take: 20,
    }),
    db.memoryState.findMany({ where: { userId } }),
  ]);

  // Not enough data for insights
  if (quizAttempts.length < 2 && focusEvents.length < 2 && learningSessions.length < 2) {
    return ["Complete more lessons and quizzes to unlock personalized learning insights."];
  }

  const insights: string[] = [];

  // Visual vs reading performance
  const visualScore = profile.visualPreference;
  const readingScore = profile.readingPreference;
  if (visualScore > readingScore + 0.15) {
    insights.push("You understand visual explanations much faster. I'll use more diagrams and analogies.");
  } else if (readingScore > visualScore + 0.15) {
    insights.push("You process written explanations well. I'll keep explanations text-focused and precise.");
  }

  // Reasoning vs memorization
  if (profile.reasoningAbility > profile.conceptualUnderstanding + 0.15) {
    insights.push("You solve reasoning problems better than memorisation questions. I'll challenge you with more analytical tasks.");
  } else if (profile.conceptualUnderstanding > profile.reasoningAbility + 0.15) {
    insights.push("You're strong on concepts but reasoning needs work. I'll add more problem-solving questions.");
  }

  // Memory retention
  if (memoryStates.length > 0) {
    const avgRetention = memoryStates.reduce((s, m) => s + m.retention, 0) / memoryStates.length;
    if (avgRetention > 0.7) {
      insights.push("You retain concepts well after solving problems. Keep practising actively.");
    } else if (avgRetention < 0.4) {
      insights.push("Your retention drops quickly. I'll schedule more frequent revisions to lock in concepts.");
    }
  }

  // Attention span
  if (profile.attentionSpan > 0.7) {
    insights.push("You maintain focus well in long sessions. Deep work mode suits you.");
  } else if (profile.attentionSpan < 0.35) {
    insights.push("You usually lose focus after shorter periods. I recommend 15-minute focused sessions with breaks.");
  }

  // Time-of-day analysis from focus events
  if (focusEvents.length >= 3) {
    const hourCounts = new Map<number, number>();
    for (const e of focusEvents) {
      const h = e.createdAt.getHours();
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    }
    const sortedHours = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedHours.length > 0) {
      const topHour = sortedHours[0][0];
      if (topHour < 12) insights.push("Morning study sessions produce your highest engagement. Keep it up!");
      else if (topHour >= 18) insights.push("Evening sessions work well for you. Consider winding down with revision.");
      else insights.push("Afternoon study sessions are your most productive.");
    }
  }

  // Confidence trend
  if (profile.confidenceGrowth > 0.1) {
    insights.push("Your confidence is growing steadily. You're ready for harder challenges!");
  } else if (profile.confidenceGrowth < -0.05) {
    insights.push("Your confidence has dipped slightly. Let's review fundamentals and rebuild momentum.");
  }

  // Mistake patterns
  const mistakePatterns: { pattern: string; frequency: number }[] =
    profile.mistakePatterns ? JSON.parse(profile.mistakePatterns) : [];
  if (mistakePatterns.length > 0 && mistakePatterns[0].frequency >= 3) {
    insights.push(`You keep making the same mistake: "${mistakePatterns[0].pattern}". Let's address this directly.`);
  }

  // Speed
  if (profile.learningSpeed > 0.7) {
    insights.push("You learn quickly. I'll increase the pace and introduce advanced concepts sooner.");
  } else if (profile.learningSpeed < 0.3) {
    insights.push("You learn best with patience and repetition. I'll slow down and reinforce fundamentals.");
  }

  return insights.slice(0, 6);
}

/**
 * Get a complete Learning DNA snapshot for the UI.
 */
export async function getLearningDNA(userId: string) {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const insights = await generateInsights(userId);
  const mistakePatterns: { pattern: string; frequency: number; lastSeen: string }[] =
    profile.mistakePatterns ? JSON.parse(profile.mistakePatterns) : [];
  const misconceptions: { topic: string; description: string }[] =
    profile.misconceptions ? JSON.parse(profile.misconceptions) : [];
  const strengths: string[] = profile.strengths ? JSON.parse(profile.strengths) : [];
  const weaknesses: string[] = profile.weaknesses ? JSON.parse(profile.weaknesses) : [];

  return {
    priorKnowledge: Math.round(profile.priorKnowledge * 100),
    conceptualUnderstanding: Math.round(profile.conceptualUnderstanding * 100),
    reasoningAbility: Math.round(profile.reasoningAbility * 100),
    confidence: Math.round(profile.confidence * 100),
    learningSpeed: Math.round(profile.learningSpeed * 100),
    visualPreference: Math.round(profile.visualPreference * 100),
    readingPreference: Math.round(profile.readingPreference * 100),
    problemSolving: Math.round(profile.problemSolving * 100),
    logicalThinking: Math.round(profile.logicalThinking * 100),
    memoryRetention: Math.round(profile.memoryRetention * 100),
    attentionSpan: Math.round(profile.attentionSpan * 100),
    confidenceGrowth: Math.round(profile.confidenceGrowth * 100),
    preferredStyle: profile.preferredStyle,
    teachingMode: profile.teachingMode,
    strengths,
    weaknesses,
    misconceptions,
    mistakePatterns,
    insights,
    totalAssessed: profile.totalAssessed,
    lastUpdated: profile.lastUpdated,
  };
}
