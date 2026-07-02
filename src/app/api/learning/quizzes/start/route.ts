/**
 * POST /api/learning/quizzes/start — start an adaptive quiz session.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { startQuizSchema } from "@/lib/validators";
import { startAdaptiveQuiz } from "@/lib/learning-service";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }
  const parsed = startQuizSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const sessionState = await startAdaptiveQuiz(session.user.id, {
      skillId: parsed.data.skillId,
      lessonId: parsed.data.lessonId,
      quizId: parsed.data.quizId,
      questionCount: parsed.data.questionCount,
    });
    return ok({
      attemptId: sessionState.attemptId,
      question: sessionState.question
        ? {
            id: sessionState.question.id,
            prompt: sessionState.question.prompt,
            options: JSON.parse(sessionState.question.options ?? "[]"),
            difficulty: sessionState.question.difficulty,
            skillId: sessionState.question.skillId,
          }
        : null,
      progress: sessionState.progress,
      mastery: sessionState.mastery,
    });
  } catch (err) {
    return ApiError.Internal(
      err instanceof Error ? err.message : "Failed to start quiz"
    );
  }
}
