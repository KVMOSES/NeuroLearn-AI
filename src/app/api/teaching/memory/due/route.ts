/**
 * GET /api/teaching/memory/due — get topics due for revision based on the memory model.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { getDueRevisionTopics } from "@/lib/teaching";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const due = await getDueRevisionTopics(session.user.id, 15);

  // Also get overall memory stats
  const allMemory = await db.memoryState.findMany({
    where: { userId: session.user.id },
    include: { topic: { select: { id: true, title: true, document: { select: { title: true } } } } },
  });

  const avgRetention = allMemory.length > 0
    ? allMemory.reduce((s, m) => s + m.retention, 0) / allMemory.length
    : 0;

  return ok({
    due: due.map((d) => ({
      topicId: d.topicId,
      title: d.topic.title,
      document: d.topic.document.title,
      retrievability: Math.round(d.retrievability * 100),
      nextReview: d.nextReview,
    })),
    stats: {
      totalTracked: allMemory.length,
      dueCount: due.length,
      avgRetention: Math.round(avgRetention * 100),
      strongCount: allMemory.filter((m) => m.retention > 0.7).length,
      weakCount: allMemory.filter((m) => m.retention < 0.4).length,
    },
  });
}
