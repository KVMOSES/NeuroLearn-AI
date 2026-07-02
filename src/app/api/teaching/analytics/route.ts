/**
 * GET /api/teaching/analytics — teaching analytics: concept mastery, retention,
 * learning speed, confidence, quiz accuracy, reasoning improvement, time spent.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const userId = session.user.id;

  const [profile, memoryStates, learningSessions, quizAttempts, learningPlans, diagnosticSessions] = await Promise.all([
    db.learnerProfile.findUnique({ where: { userId } }),
    db.memoryState.findMany({ where: { userId }, include: { topic: { select: { title: true, document: { select: { title: true } } } } } }),
    db.learningSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" } }),
    db.quizAttempt.findMany({ where: { userId }, include: { quiz: true, answers: { include: { question: true } } }, orderBy: { startedAt: "asc" } }),
    db.learningPlan.findMany({ where: { userId }, include: { items: true, document: { select: { title: true } } } }),
    db.diagnosticSession.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }),
  ]);

  // Concept mastery (from memory states)
  const conceptMastery = memoryStates.map((m) => ({
    topic: m.topic.title,
    document: m.topic.document.title,
    retention: Math.round(m.retention * 100),
    retrievability: Math.round(m.retrievability * 100),
    repetitions: m.repetitions,
    nextReview: m.nextReview,
  }));

  // Strong vs weak topics
  const strongTopics = conceptMastery.filter((c) => c.retention > 0.7).map((c) => c.topic);
  const weakTopics = conceptMastery.filter((c) => c.retention < 0.4).map((c) => c.topic);

  // Quiz accuracy trend
  const quizTrend = quizAttempts
    .filter((a) => a.completedAt)
    .slice(-10)
    .map((a, i) => ({
      attempt: i + 1,
      score: Math.round(a.score * 100),
      quiz: a.quiz.title,
    }));

  // Reasoning improvement — compare early vs recent quiz answer analysis
  let reasoningImprovement = 0;
  if (quizAttempts.length >= 2) {
    const early = quizAttempts.slice(0, Math.max(1, Math.floor(quizAttempts.length / 2)));
    const recent = quizAttempts.slice(Math.floor(quizAttempts.length / 2));
    const earlyAvg = early.reduce((s, a) => s + a.score, 0) / early.length;
    const recentAvg = recent.reduce((s, a) => s + a.score, 0) / recent.length;
    reasoningImprovement = Math.round((recentAvg - earlyAvg) * 100);
  }

  // Learning plan progress
  const planProgress = learningPlans.map((p) => ({
    document: p.document.title,
    totalTopics: p.totalTopics,
    completedTopics: p.completedTopics,
    progress: p.totalTopics > 0 ? Math.round((p.completedTopics / p.totalTopics) * 100) : 0,
    estimatedMinutes: p.estimatedMinutes,
  }));

  // Time spent (from learning sessions + quiz times)
  const lessonTime = learningSessions.reduce((s, ls) => {
    if (ls.completedAt) return s + (ls.completedAt.getTime() - ls.startedAt.getTime()) / 1000;
    return s;
  }, 0);

  return ok({
    profile: profile ? {
      priorKnowledge: Math.round(profile.priorKnowledge * 100),
      conceptualUnderstanding: Math.round(profile.conceptualUnderstanding * 100),
      reasoningAbility: Math.round(profile.reasoningAbility * 100),
      confidence: Math.round(profile.confidence * 100),
      learningSpeed: Math.round(profile.learningSpeed * 100),
      preferredStyle: profile.preferredStyle,
      strengths: profile.strengths ? JSON.parse(profile.strengths) : [],
      weaknesses: profile.weaknesses ? JSON.parse(profile.weaknesses) : [],
      misconceptions: profile.misconceptions ? JSON.parse(profile.misconceptions) : [],
    } : null,
    conceptMastery,
    strongTopics,
    weakTopics,
    quizTrend,
    reasoningImprovement,
    avgQuizScore: quizAttempts.length > 0 ? Math.round((quizAttempts.reduce((s, a) => s + a.score, 0) / quizAttempts.length) * 100) : 0,
    planProgress,
    stats: {
      totalLessons: learningSessions.length,
      completedLessons: learningSessions.filter((ls) => ls.status === "completed").length,
      totalQuizzes: quizAttempts.length,
      avgRetention: memoryStates.length > 0 ? Math.round((memoryStates.reduce((s, m) => s + m.retention, 0) / memoryStates.length) * 100) : 0,
      timeSpentMinutes: Math.round(lessonTime / 60),
      diagnosticsCompleted: diagnosticSessions.filter((d) => d.status === "completed").length,
      topicsTracked: memoryStates.length,
    },
  });
}
