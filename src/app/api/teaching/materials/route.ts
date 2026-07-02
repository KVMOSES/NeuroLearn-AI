/**
 * GET /api/teaching/materials — list all analyzed learning materials (documents with topics).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const docs = await db.document.findMany({
    where: { userId: session.user.id, status: "ready" },
    include: {
      _count: { select: { topics: true, chunks: true, flashcards: true, quizzes: true } },
      learningPlans: { where: { userId: session.user.id }, select: { id: true, status: true, completedTopics: true, totalTopics: true } },
      diagnostics: { where: { userId: session.user.id }, select: { id: true, status: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return ok({
    materials: docs.map((d) => ({
      id: d.id,
      title: d.title,
      sourceType: d.sourceType,
      wordCount: d.wordCount,
      summary: d.summary,
      updatedAt: d.updatedAt,
      analyzed: d._count.topics > 0,
      topicCount: d._count.topics,
      chunkCount: d._count.chunks,
      flashcardCount: d._count.flashcards,
      quizCount: d._count.quizzes,
      hasDiagnostic: d.diagnostics.length > 0,
      diagnosticStatus: d.diagnostics[0]?.status ?? null,
      planStatus: d.learningPlans[0]?.status ?? null,
      planProgress: d.learningPlans[0] && d.learningPlans[0].totalTopics > 0
        ? Math.round((d.learningPlans[0].completedTopics / d.learningPlans[0].totalTopics) * 100)
        : 0,
    })),
  });
}
