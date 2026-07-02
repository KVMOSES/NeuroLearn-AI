/**
 * POST /api/learning/progress — upsert lesson progress.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { lessonProgressSchema } from "@/lib/validators";
import { upsertLessonProgress } from "@/lib/learning-service";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }
  const parsed = lessonProgressSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const progress = await upsertLessonProgress(session.user.id, parsed.data.lessonId, {
    status: parsed.data.status,
    timeSpent: parsed.data.timeSpent,
  });

  return ok({ progress });
}
