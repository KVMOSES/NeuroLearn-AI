/**
 * GET  /api/teaching/plan/:documentId — get the user's learning plan for a document.
 * POST /api/teaching/plan/:documentId — generate/regenerate the learning plan.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateLearningPlan } from "@/lib/teaching";

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { documentId } = await params;

  const plan = await db.learningPlan.findUnique({
    where: { userId_documentId: { userId: session.user.id, documentId } },
    include: {
      items: {
        include: { topic: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!plan) return ok({ plan: null });

  return ok({
    plan: {
      id: plan.id,
      status: plan.status,
      totalTopics: plan.totalTopics,
      completedTopics: plan.completedTopics,
      estimatedMinutes: plan.estimatedMinutes,
      items: plan.items.map((item) => ({
        id: item.id,
        order: item.order,
        status: item.status,
        isWeak: item.isWeak,
        isPrereq: item.isPrereq,
        scheduledFor: item.scheduledFor,
        topic: {
          id: item.topic.id,
          title: item.topic.title,
          summary: item.topic.summary,
          level: item.topic.level,
          difficulty: item.topic.difficulty,
          estimatedMinutes: item.topic.estimatedMinutes,
        },
      })),
    },
  });
}

export async function POST(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { documentId } = await params;

  const doc = await db.document.findFirst({ where: { id: documentId, userId: session.user.id } });
  if (!doc) return ApiError.NotFound("Document");

  try {
    await generateLearningPlan(session.user.id, documentId);
    return ok({ generated: true });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Failed to generate plan");
  }
}
