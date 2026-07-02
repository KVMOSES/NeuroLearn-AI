/**
 * POST /api/teaching/socratic/:topicId
 * Socratic teaching interaction — guides the student via questions.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { socraticTeach, type LessonStep } from "@/lib/teaching";
import { z } from "zod";

const schema = z.object({
  studentInput: z.string().nullable().default(null),
  lessonSteps: z.array(z.any()).default([]),
  stepIndex: z.number().int().default(0),
  previousInteractions: z.array(z.object({ role: z.string(), content: z.string() })).default([]),
});

export async function POST(req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { topicId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const topic = await db.topic.findUnique({ where: { id: topicId } });
  if (!topic) return ApiError.NotFound("Topic");

  try {
    const response = await socraticTeach(
      session.user.id,
      topicId,
      parsed.data.studentInput,
      {
        stepIndex: parsed.data.stepIndex,
        lessonSteps: parsed.data.lessonSteps as LessonStep[],
        previousInteractions: parsed.data.previousInteractions,
      }
    );
    return ok({ response, topicId });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Socratic teaching failed");
  }
}
