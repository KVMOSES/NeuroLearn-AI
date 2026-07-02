/**
 * POST /api/teaching/lesson/start/:topicId
 * Generates (or reuses) an interactive lesson and starts a learning session.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateInteractiveLesson } from "@/lib/teaching";
import { awardXP } from "@/lib/gamification";

export async function POST(_req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { topicId } = await params;

  const topic = await db.topic.findUnique({
    where: { id: topicId },
    include: { document: true },
  });
  if (!topic) return ApiError.NotFound("Topic");
  if (topic.document.userId !== session.user.id) return ApiError.Forbidden();

  try {
    const { lessonId, steps } = await generateInteractiveLesson(topicId, session.user.id);

    // Create a learning session
    const learningSession = await db.learningSession.create({
      data: {
        userId: session.user.id,
        lessonId,
        topicId,
        status: "active",
        currentStep: 0,
        socratic: true,
      },
    });

    await awardXP(session.user.id, "lesson_complete", 0, topicId);

    return ok({
      sessionId: learningSession.id,
      lessonId,
      topic: { id: topic.id, title: topic.title, summary: topic.summary },
      steps: steps.map((s, i) => ({ ...s, index: i })),
      totalSteps: steps.length,
      currentStep: 0,
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Failed to start lesson");
  }
}
