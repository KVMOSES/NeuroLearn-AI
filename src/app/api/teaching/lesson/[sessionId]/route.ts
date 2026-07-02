/**
 * GET /api/teaching/lesson/:sessionId — get lesson session state.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { sessionId } = await params;

  const learningSession = await db.learningSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
    include: { lesson: { include: { topic: true } } },
  });
  if (!learningSession) return ApiError.NotFound("Lesson session");

  const steps = JSON.parse(learningSession.lesson.stepsJson);
  return ok({
    sessionId: learningSession.id,
    status: learningSession.status,
    currentStep: learningSession.currentStep,
    totalSteps: steps.length,
    topic: { id: learningSession.lesson.topic.id, title: learningSession.lesson.topic.title, summary: learningSession.lesson.topic.summary },
    steps: steps.map((s: any, i: number) => ({ ...s, index: i })),
    socratic: learningSession.socratic,
  });
}
