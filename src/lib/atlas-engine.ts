/**
 * Atlas Intelligence Engine — transforms the AI from a chatbot into a true AI Teacher.
 *
 * Pillars implemented:
 * 1. Persistent Student Memory — conversation summaries injected into system prompt
 * 3. Socratic Teaching — rules for when to ask questions instead of answering
 * 4. Misconception Detection — tracks recurring mistakes and adapts
 * 8. Proactive Coaching — generates "you haven't reviewed X" messages
 * 9. Reflection Engine — end-of-session summaries with predictions
 * 10. Teaching Structure — greeting → connect → explain → analogy → example → question → challenge → recommend
 * 11. Conversation Memory — references previous interactions naturally
 * 12. Learning Style Adaptation — infers style from behavior
 * 13. Motivation System — celebrates real progress
 * 14. AI Safety — uncertainty handling
 */
import { db } from "@/lib/db";
import { generateJSON } from "@/lib/ai";

// ============================================================
// PILLAR 1+11 — CONVERSATION MEMORY
// ============================================================

interface ConversationSummary {
  date: string;
  summary: string;
  topicsDiscussed: string[];
  misconceptionsFound: string[];
  studentMood?: "confident" | "struggling" | "curious" | "frustrated";
}

/**
 * Summarize a conversation and store it in the learner profile's durable memory.
 * Called when a conversation ends (or after every 10 messages).
 */
export async function summarizeConversation(
  userId: string,
  conversationId: string,
  messages: { role: string; content: string }[]
): Promise<ConversationSummary | null> {
  if (messages.length < 4) return null; // Don't summarize very short conversations

  const conversationText = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n\n");

  const { data: summary } = await generateJSON<ConversationSummary>([
    {
      role: "system",
      content: `Summarize this learning conversation for long-term memory. Extract:
- A 2-3 sentence summary of what was discussed and learned
- Topics discussed (array of short topic names)
- Any misconceptions detected (array of short descriptions)
- Student's apparent mood/confidence level

Return ONLY strict JSON:
{"date":"YYYY-MM-DD","summary":"2-3 sentences","topicsDiscussed":["topic1","topic2"],"misconceptionsFound":["misconception1"],"studentMood":"confident|struggling|curious|frustrated"}`,
    },
    { role: "user", content: conversationText.slice(0, 8000) },
  ]);

  if (!summary) return null;

  try {
    summary.date = new Date().toISOString().slice(0, 10);

    // Store in learner profile
    const profile = await db.learnerProfile.findUnique({ where: { userId } });
    if (profile) {
      const existing: ConversationSummary[] = profile.conversationMemory
        ? JSON.parse(profile.conversationMemory)
        : [];
      // Keep only the last 20 conversation summaries
      existing.push(summary);
      const trimmed = existing.slice(-20);

      await db.learnerProfile.update({
        where: { userId },
        data: {
          conversationMemory: JSON.stringify(trimmed),
          lastUpdated: new Date(),
        },
      });
    }

    return summary;
  } catch {
    return null;
  }
}

/**
 * Build a conversation memory prompt for the AI system prompt.
 * This is what makes Atlas "remember" previous sessions.
 */
export async function getConversationMemoryPrompt(userId: string): Promise<string> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  if (!profile?.conversationMemory) return "";

  const memories: ConversationSummary[] = JSON.parse(profile.conversationMemory);
  if (memories.length === 0) return "";

  // Use only the last 5 conversations for the prompt (to stay within token limits)
  const recent = memories.slice(-5);
  const memoryText = recent
    .map((m) => `[${m.date}] ${m.summary} Topics: ${m.topicsDiscussed.join(", ")}.${m.misconceptionsFound.length > 0 ? ` Misconceptions: ${m.misconceptionsFound.join("; ")}` : ""}${m.studentMood ? ` Mood: ${m.studentMood}` : ""}`)
    .join("\n");

  return `\n\nCONVERSATION MEMORY (previous sessions — reference these naturally):
${memoryText}

Rules for using conversation memory:
- Reference previous conversations naturally ("Last time we discussed...", "You mentioned earlier that...")
- Don't repeat explanations for topics the student already understands
- If a misconception was found previously, check if it's resolved
- Adapt tone based on past mood (if student was frustrated, be more patient)`;
}

// ============================================================
// PILLAR 3+10 — SOCRATIC TEACHING + TEACHING STRUCTURE
// ============================================================

/**
 * Build the teaching instructions for the AI system prompt.
 * Implements the Socratic method and structured teaching format.
 */
export function getTeachingInstructions(profile: {
  priorKnowledge: number;
  reasoningAbility: number;
  confidence: number;
  learningSpeed: number;
  visualPreference: number;
  misconceptions: { topic: string; description: string }[];
  mistakePatterns: { pattern: string; frequency: number }[];
}): string {
  const prior = profile.priorKnowledge;
  const isBeginner = prior < 0.35;
  const isAdvanced = prior > 0.7;
  const hasMisconceptions = profile.misconceptions.length > 0;
  const hasRecurringMistakes = profile.mistakePatterns.some((m) => m.frequency >= 3);

  let instructions = `\n\nTEACHING INSTRUCTIONS:

1. STRUCTURE: When teaching a new concept, follow this structure:
   - Connect to what the student already knows
   - Explain the concept clearly
   - Give an analogy or real-world example
   - Show a worked example
   - Ask a check-for-understanding question
   - Recommend what to learn next

2. ADAPTIVE DIFFICULTY: `;

  if (isBeginner) {
    instructions += `This student is a beginner. Use simple language, everyday analogies, and step-by-step explanations. Define all technical terms. Don't assume prior knowledge.`;
  } else if (isAdvanced) {
    instructions += `This student is advanced. Skip basics, use technical depth, include edge cases and optimizations. Challenge them with harder problems.`;
  } else {
    instructions += `This student is at intermediate level. Balance intuition with technical detail. Use worked examples and check understanding periodically.`;
  }

  instructions += `\n\n3. SOCRATIC METHOD: Use guided discovery ~30% of the time. Instead of always answering directly:
   - Ask "What do you think happens here?" before explaining
   - Ask "Can you predict the result?" before showing
   - Ask "Why do you think that?" to probe reasoning
   - Only use Socratic method when it helps learning. Don't overuse it.`;

  if (hasMisconceptions) {
    instructions += `\n\n4. MISCONCEPTION CORRECTION: This student has known misconceptions:
${profile.misconceptions.map((m) => `   - ${m.topic}: ${m.description}`).join("\n")}
   Address these proactively. If the student's response suggests a misconception, correct it gently with a different analogy or approach.`;
  }

  if (hasRecurringMistakes) {
    instructions += `\n\n5. RECURRING MISTAKES: This student repeatedly makes these mistakes:
${profile.mistakePatterns.filter((m) => m.frequency >= 3).map((m) => `   - ${m.pattern} (seen ${m.frequency} times)`).join("\n")}
   Teach these concepts differently. Use a different analogy. Generate additional practice.`;
  }

  if (profile.confidence < 0.35) {
    instructions += `\n\n6. CONFIDENCE BUILDING: This student's confidence is low (${Math.round(profile.confidence * 100)}%). Be especially encouraging. Celebrate small wins. Don't overwhelm with difficulty.`;
  } else if (profile.confidence > 0.75) {
    instructions += `\n\n6. CHALLENGE: This student is confident (${Math.round(profile.confidence * 100)}%). Push them harder. Introduce advanced concepts and edge cases.`;
  }

  instructions += `\n\n7. MOTIVATION: Use real progress data for motivation. Don't use empty praise. Reference specific improvements when relevant.

8. SAFETY: If you're uncertain, state it clearly. Offer multiple possibilities. Never fabricate facts. Distinguish between known information and inference.

9. PACE: This student learns ${profile.learningSpeed > 0.6 ? "quickly — move at a brisk pace" : "at a measured pace — be patient and thorough"}.`;

  if (profile.visualPreference > 0.65) {
    instructions += `\n\n10. VISUAL PREFERENCE: This student prefers visual explanations. Use analogies, mental models, and "imagine..." descriptions frequently.`;
  }

  return instructions;
}

// ============================================================
// PILLAR 8 — PROACTIVE COACHING
// ============================================================

export interface ProactiveMessage {
  type: "review_reminder" | "forgetting_warning" | "improvement_celebration" | "streak_encouragement" | "next_step";
  message: string;
  topicName?: string;
  urgency: "low" | "medium" | "high";
}

/**
 * Generate proactive coaching messages based on real learning data.
 * Called on dashboard load to show "Atlas says..." messages.
 */
export async function getProactiveMessages(userId: string): Promise<ProactiveMessage[]> {
  const messages: ProactiveMessage[] = [];

  const [memoryStates, profile, xpEvents, quizAttempts] = await Promise.all([
    db.memoryState.findMany({
      where: { userId },
      include: { topic: { select: { title: true } } },
      orderBy: { nextReview: "asc" },
      take: 20,
    }),
    db.learnerProfile.findUnique({ where: { userId } }),
    db.xPEvent.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      orderBy: { createdAt: "desc" },
    }),
    db.quizAttempt.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);

  // Check for topics at risk of forgetting
  const now = new Date();
  const overdueTopics = memoryStates.filter((m) => m.nextReview < now && m.retention > 0.1);
  if (overdueTopics.length > 0) {
    const topic = overdueTopics[0];
    const daysOverdue = Math.floor((now.getTime() - topic.nextReview.getTime()) / 86400000);
    messages.push({
      type: "review_reminder",
      message: daysOverdue > 3
        ? `"${topic.topic.title}" is at risk of being forgotten. You haven't reviewed it in ${daysOverdue} days. Spend 5 minutes to lock it in.`
        : `Quick review: "${topic.topic.title}" is due for revision today. It'll only take a few minutes.`,
      topicName: topic.topic.title,
      urgency: daysOverdue > 5 ? "high" : daysOverdue > 2 ? "medium" : "low",
    });
  }

  // Check for retention drops
  const lowRetention = memoryStates.filter((m) => m.retention < 0.3 && m.retention > 0.05);
  if (lowRetention.length > 0) {
    messages.push({
      type: "forgetting_warning",
      message: `"${lowRetention[0].topic.title}" retention has dropped to ${Math.round(lowRetention[0].retention * 100)}%. Let's review before it fades completely.`,
      topicName: lowRetention[0].topic.title,
      urgency: "high",
    });
  }

  // Celebrate improvements
  if (quizAttempts.length >= 2) {
    const recent = quizAttempts[0];
    const previous = quizAttempts[1];
    if (recent.score > previous.score + 0.1) {
      const improvement = Math.round((recent.score - previous.score) * 100);
      messages.push({
        type: "improvement_celebration",
        message: `Your quiz accuracy improved by ${improvement}% since last time. That's real progress!`,
        urgency: "low",
      });
    }
  }

  // Streak encouragement
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user && user.currentStreak >= 3) {
    if (user.currentStreak === 7) {
      messages.push({
        type: "streak_encouragement",
        message: `7-day streak! You're building a real learning habit. Consistency is the #1 predictor of success.`,
        urgency: "low",
      });
    } else if (user.currentStreak === 30) {
      messages.push({
        type: "streak_encouragement",
        message: `30 days! This is extraordinary consistency. You're in the top 1% of learners.`,
        urgency: "low",
      });
    }
  }

  // Next step recommendation
  if (profile?.weaknesses) {
    const weaknesses: string[] = JSON.parse(profile.weaknesses);
    if (weaknesses.length > 0 && messages.length === 0) {
      messages.push({
        type: "next_step",
        message: `Your weakest area is "${weaknesses[0]}". Focusing here will give the biggest improvement.`,
        topicName: weaknesses[0],
        urgency: "medium",
      });
    }
  }

  return messages.slice(0, 3); // Max 3 proactive messages
}

// ============================================================
// PILLAR 9 — REFLECTION ENGINE
// ============================================================

export interface SessionReflection {
  whatYouLearned: string;
  strongestImprovement: string;
  mostDifficultConcept: string;
  challengeQuestion: string;
  recommendedNextLesson: string;
  estimatedRetentionTomorrow: number;
  suggestedReviewSchedule: string;
  xpEarned: number;
  timeSpent: number;
  topicsCovered: string[];
}

/**
 * Generate a reflection summary at the end of a learning session.
 * Uses real data from the session (XP earned, topics covered, quiz performance).
 */
export async function generateSessionReflection(
  userId: string,
  sessionData: {
    xpEarned: number;
    timeSpentMinutes: number;
    topicIds: string[];
    quizScores: number[];
    correctAnswers: number;
    totalAnswers: number;
  }
): Promise<SessionReflection> {
  const [profile, memoryStates, topics] = await Promise.all([
    db.learnerProfile.findUnique({ where: { userId } }),
    db.memoryState.findMany({
      where: { userId, topicId: { in: sessionData.topicIds } },
      include: { topic: { select: { title: true } } },
    }),
    db.topic.findMany({
      where: { id: { in: sessionData.topicIds } },
      select: { id: true, title: true, summary: true },
    }),
  ]);

  const topicNames = topics.map((t) => t.title);
  const avgQuizScore = sessionData.quizScores.length > 0
    ? sessionData.quizScores.reduce((s, v) => s + v, 0) / sessionData.quizScores.length
    : 0;

  // Calculate estimated retention tomorrow (using FSRS-like decay)
  const avgRetention = memoryStates.length > 0
    ? memoryStates.reduce((s, m) => s + m.retention, 0) / memoryStates.length
    : 0.5;
  // Retention drops ~10-20% overnight without review
  const estimatedRetentionTomorrow = Math.max(0.1, avgRetention * 0.85);

  // Generate challenge question and recommendations using AI
  const contextText = `Topics: ${topicNames.join(", ")}
Quiz scores: ${sessionData.quizScores.map((s) => Math.round(s * 100) + "%").join(", ")}
Correct answers: ${sessionData.correctAnswers}/${sessionData.totalAnswers}
Student weaknesses: ${profile?.weaknesses ? JSON.parse(profile.weaknesses).join(", ") : "none identified"}
Student misconceptions: ${profile?.misconceptions ? JSON.parse(profile.misconceptions).map((m: any) => m.topic).join(", ") : "none"}`;

  const { data: reflection } = await generateJSON<Partial<SessionReflection>>([
    {
      role: "system",
      content: `Generate a session reflection for a learning session. Return ONLY strict JSON:
{
  "whatYouLearned": "1-2 sentences about what concepts were covered",
  "strongestImprovement": "1 sentence about the biggest improvement observed",
  "mostDifficultConcept": "1 sentence about the hardest concept (or 'No major difficulties' if all went well)",
  "challengeQuestion": "A short challenge question to test retention tomorrow",
  "recommendedNextLesson": "1 sentence recommending what to study next",
  "suggestedReviewSchedule": "1 sentence about when to review (e.g., 'Review in 2 days to maintain retention')"
}
Base everything on the real session data provided.`,
    },
    { role: "user", content: contextText },
  ]);

  return {
    whatYouLearned: reflection?.whatYouLearned ?? `You covered ${topicNames.length} topics: ${topicNames.join(", ")}.`,
    strongestImprovement: reflection?.strongestImprovement ?? avgQuizScore > 0.7 ? "Strong performance on quiz questions." : "You're making steady progress.",
    mostDifficultConcept: reflection?.mostDifficultConcept ?? "Review the topics that felt challenging today.",
    challengeQuestion: reflection?.challengeQuestion ?? `Can you explain ${topicNames[0] ?? "today's topic"} in your own words?`,
    recommendedNextLesson: reflection?.recommendedNextLesson ?? "Continue with the next topic in your learning plan.",
    estimatedRetentionTomorrow: Math.round(estimatedRetentionTomorrow * 100),
    suggestedReviewSchedule: reflection?.suggestedReviewSchedule ?? "Review these topics in 2 days to maintain retention.",
    xpEarned: sessionData.xpEarned,
    timeSpent: sessionData.timeSpentMinutes,
    topicsCovered: topicNames,
  };
}

// ============================================================
// PILLAR 6+7 — ENHANCED INSIGHTS & PREDICTIONS
// ============================================================

export interface LearningPrediction {
  examReadiness: number;
  forgettingForecast: { topic: string; daysUntilForgot: number; currentRetention: number }[];
  highestImpactTopic: string | null;
  predictions: string[];
}

/**
 * Generate learning predictions using BKT and memory model data.
 */
export async function getLearningPredictions(userId: string): Promise<LearningPrediction> {
  const [memoryStates, knowledgeStates, profile] = await Promise.all([
    db.memoryState.findMany({
      where: { userId },
      include: { topic: { select: { title: true } } },
    }),
    db.knowledgeState.findMany({
      where: { userId },
      include: { skill: { select: { name: true } } },
    }),
    db.learnerProfile.findUnique({ where: { userId } }),
  ]);

  // Exam readiness from BKT (knowledge states)
  const masteryValues = knowledgeStates.map((k) => k.pKnown);
  const examReadiness = masteryValues.length > 0
    ? Math.round(masteryValues.reduce((s, v) => s + v, 0) / masteryValues.length * 100)
    : 0;

  // Forgetting forecast from memory states
  const now = new Date();
  const forgettingForecast = memoryStates
    .map((m) => {
      const daysSinceReview = m.lastReview
        ? Math.floor((now.getTime() - m.lastReview.getTime()) / 86400000)
        : 0;
      // Retention decays: R = exp(-days / stability)
      const daysUntilForgot = m.stability > 0
        ? Math.floor(-m.stability * Math.log(0.1)) // Days until retention drops to 10%
        : 1;
      return {
        topic: m.topic.title,
        daysUntilForgot: Math.max(0, daysUntilForgot - daysSinceReview),
        currentRetention: Math.round(m.retention * 100),
      };
    })
    .filter((f) => f.daysUntilForgot <= 7) // Only show topics at risk within a week
    .sort((a, b) => a.daysUntilForgot - b.daysUntilForgot)
    .slice(0, 5);

  // Highest impact topic (lowest mastery + highest difficulty)
  const weaknesses: string[] = profile?.weaknesses ? JSON.parse(profile.weaknesses) : [];
  const highestImpactTopic = weaknesses.length > 0 ? weaknesses[0] : null;

  // Generate prediction strings
  const predictions: string[] = [];

  if (examReadiness > 0) {
    if (examReadiness >= 80) {
      predictions.push(`You're ${examReadiness}% ready for an exam on your current material. Focus on edge cases to push higher.`);
    } else if (examReadiness >= 50) {
      predictions.push(`You're ${examReadiness}% ready. Reviewing weak topics could push you to 70%+ within a week.`);
    } else {
      predictions.push(`You're ${examReadiness}% ready. Focus on foundational concepts before attempting advanced problems.`);
    }
  }

  if (forgettingForecast.length > 0) {
    const mostAtRisk = forgettingForecast[0];
    predictions.push(`"${mostAtRisk.topic}" will drop to ${mostAtRisk.currentRetention}% retention. Review it ${mostAtRisk.daysUntilForgot === 0 ? "today" : `in ${mostAtRisk.daysUntilForgot} day(s)`}.`);
  }

  if (highestImpactTopic) {
    predictions.push(`Studying "${highestImpactTopic}" will give the highest expected score improvement.`);
  }

  if (profile?.confidenceGrowth && profile.confidenceGrowth > 0.1) {
    predictions.push(`Your confidence has grown ${Math.round(profile.confidenceGrowth * 100)}% recently. You're ready for harder challenges.`);
  }

  if (profile?.learningSpeed && profile.learningSpeed > 0.65) {
    predictions.push(`You learn quickly — consider tackling advanced topics to maximize your time.`);
  } else if (profile?.learningSpeed && profile.learningSpeed < 0.35) {
    predictions.push(`You learn best with patience. Focus on deep understanding over speed.`);
  }

  return {
    examReadiness,
    forgettingForecast,
    highestImpactTopic,
    predictions: predictions.slice(0, 5),
  };
}
