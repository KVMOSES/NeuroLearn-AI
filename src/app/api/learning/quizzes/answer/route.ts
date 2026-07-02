/**
 * POST /api/learning/quizzes/answer — submit an answer in an adaptive quiz.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { quizAnswerSchema } from "@/lib/validators";
import { submitAdaptiveAnswer } from "@/lib/learning-service";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }
  const parsed = quizAnswerSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const result = await submitAdaptiveAnswer(
      session.user.id,
      parsed.data.attemptId,
      parsed.data.questionId,
      parsed.data.selectedIndex,
      parsed.data.timeMs
    );

    // Update Learning DNA after every quiz answer
    const { updateLearningDNA } = await import("@/lib/learning-dna");
    await updateLearningDNA(session.user.id, {
      type: "quiz",
      correct: result.correct,
      score: result.correct ? 1 : 0,
      timeSpentMs: parsed.data.timeMs,
      analysis: result.correct
        ? { reasoning: "adequate", confidence: "medium" }
        : { reasoning: "weak", confidence: "low", misconceptions: [] },
    });

    return ok({
      correct: result.correct,
      explanation: result.explanation,
      mastery: result.mastery,
      finished: result.finished,
      progress: result.progress,
      nextQuestion: result.nextQuestion
        ? {
            id: result.nextQuestion.id,
            prompt: result.nextQuestion.prompt,
            options: JSON.parse(result.nextQuestion.options ?? "[]"),
            difficulty: result.nextQuestion.difficulty,
            skillId: result.nextQuestion.skillId,
          }
        : null,
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Failed to submit answer");
  }
}
