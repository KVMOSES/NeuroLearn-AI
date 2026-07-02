/**
 * GET /api/teaching/journey
 * Returns the user's learning journey timeline — real events from their activity
 * (lessons completed, quizzes passed, documents analyzed, diagnostics taken, XP milestones).
 * Used to render a chronological progress timeline on the dashboard.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const userId = session.user.id;

  // Gather recent activity events in parallel
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [xpEvents, learningSessions, quizAttempts, diagnostics, materials] = await Promise.all([
    db.xPEvent.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.learningSession.findMany({
      where: { userId, status: "completed", completedAt: { gte: since } },
      include: { lesson: { include: { topic: { select: { title: true } } } } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    db.quizAttempt.findMany({
      where: { userId, completedAt: { gte: since } },
      include: { quiz: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    db.diagnosticSession.findMany({
      where: { userId, status: "completed", completedAt: { gte: since } },
      include: { document: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
    db.document.findMany({
      where: { userId, status: "ready", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, sourceType: true, createdAt: true },
    }),
  ]);

  interface JourneyEvent {
    id: string;
    type: "lesson" | "quiz" | "diagnostic" | "document" | "xp";
    title: string;
    description: string;
    timestamp: string;
    icon: string;
    xp?: number;
    meta?: Record<string, string | number>;
  }

  const events: JourneyEvent[] = [];

  // Lessons completed
  for (const ls of learningSessions) {
    if (!ls.completedAt) continue;
    events.push({
      id: `lesson-${ls.id}`,
      type: "lesson",
      title: `Completed: ${ls.lesson.topic.title}`,
      description: "Interactive lesson finished",
      timestamp: ls.completedAt.toISOString(),
      icon: "BookOpen",
      xp: 50,
    });
  }

  // Quizzes passed
  for (const qa of quizAttempts) {
    if (!qa.completedAt) continue;
    const passed = qa.score >= 0.7;
    events.push({
      id: `quiz-${qa.id}`,
      type: "quiz",
      title: passed ? `Passed: ${qa.quiz.title}` : `Attempted: ${qa.quiz.title}`,
      description: `Score: ${Math.round(qa.score * 100)}%`,
      timestamp: qa.completedAt.toISOString(),
      icon: passed ? "Trophy" : "Target",
      xp: passed ? 80 : 0,
      meta: { score: Math.round(qa.score * 100) },
    });
  }

  // Diagnostics completed
  for (const d of diagnostics) {
    if (!d.completedAt) continue;
    events.push({
      id: `diag-${d.id}`,
      type: "diagnostic",
      title: `Diagnostic completed: ${d.document.title}`,
      description: `${d.correctCount}/${d.questionCount} correct — learner profile updated`,
      timestamp: d.completedAt.toISOString(),
      icon: "Brain",
      xp: 0,
    });
  }

  // Documents uploaded
  for (const m of materials) {
    events.push({
      id: `doc-${m.id}`,
      type: "document",
      title: `Uploaded: ${m.title}`,
      description: `${m.sourceType.toUpperCase()} document added to library`,
      timestamp: m.createdAt.toISOString(),
      icon: "FileText",
      xp: 15,
    });
  }

  // XP milestones (only significant ones to avoid clutter)
  const xpMilestones = xpEvents.filter((e) => e.amount >= 50);
  for (const e of xpMilestones) {
    events.push({
      id: `xp-${e.id}`,
      type: "xp",
      title: `+${e.amount} XP earned`,
      description: e.reason.replace(/_/g, " "),
      timestamp: e.createdAt.toISOString(),
      icon: "Zap",
      xp: e.amount,
    });
  }

  // Sort by timestamp descending and take the most recent 15
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const timeline = events.slice(0, 15);

  // Compute summary stats for the journey
  const totalXP30d = xpEvents.reduce((s, e) => s + e.amount, 0);
  const lessonsCompleted = learningSessions.length;
  const quizzesPassed = quizAttempts.filter((q) => q.score >= 0.7).length;

  return ok({
    timeline,
    summary: {
      totalXP30d,
      lessonsCompleted,
      quizzesPassed,
      diagnosticsCompleted: diagnostics.length,
      documentsUploaded: materials.length,
      activeDays: new Set(xpEvents.map((e) => e.createdAt.toISOString().slice(0, 10))).size,
    },
  });
}
