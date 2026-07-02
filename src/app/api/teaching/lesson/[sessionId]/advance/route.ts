/**
 * POST /api/teaching/lesson/:sessionId/advance
 * Advance to the next step in an interactive lesson.
 * If the current step is a question, analyze the answer with thinking analysis.
 * Updates the learning plan item and memory state.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { analyzeThinking, updateMemoryState } from "@/lib/teaching";
import { awardXP } from "@/lib/gamification";
import { z } from "zod";

const schema = z.object({
  // For question steps:
  selectedIndex: z.number().int().nullable().optional(),
  textAnswer: z.string().nullable().optional(),
  numericAnswer: z.number().nullable().optional(),
  timeMs: z.number().int().optional().default(0),
  // Whether to advance (true) or just analyze the current answer (false)
  advance: z.boolean().default(true),
});

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { sessionId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const learningSession = await db.learningSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
    include: { lesson: { include: { topic: true } } },
  });
  if (!learningSession) return ApiError.NotFound("Lesson session");

  const steps: any[] = JSON.parse(learningSession.lesson.stepsJson);
  const currentStepData = steps[learningSession.currentStep];

  let analysis: Awaited<ReturnType<typeof analyzeThinking>> | null = null;

  // If the current step is a question, analyze the answer
  if (currentStepData?.type === "question" && (parsed.data.selectedIndex !== undefined || parsed.data.textAnswer || parsed.data.numericAnswer !== undefined)) {
    const question = {
      prompt: currentStepData.content,
      type: currentStepData.questionType ?? "mcq",
      options: currentStepData.options ? JSON.stringify(currentStepData.options) : null,
      correctIndex: currentStepData.correctIndex ?? null,
      correctAnswer: currentStepData.correctAnswer ? JSON.stringify(currentStepData.correctAnswer) : null,
      explanation: currentStepData.explanation ?? null,
    };
    const studentAnswer = {
      selectedIndex: parsed.data.selectedIndex ?? null,
      textAnswer: parsed.data.textAnswer ?? null,
      numericAnswer: parsed.data.numericAnswer ?? null,
      timeMs: parsed.data.timeMs,
    };

    analysis = await analyzeThinking(question, studentAnswer);

    // Update memory state based on the answer quality
    const quality = analysis.correct ? (analysis.confidence === "high" ? 5 : 4) : (analysis.score > 0 ? 2 : 1);
    await updateMemoryState(session.user.id, learningSession.topicId!, quality);

    // Award XP for answering
    if (analysis.correct) {
      await awardXP(session.user.id, "quiz_pass", Math.round(20 * analysis.score), learningSession.topicId!);
    }

    // Update Learning DNA after every answer
    const { updateLearningDNA } = await import("@/lib/learning-dna");
    await updateLearningDNA(session.user.id, {
      type: "lesson",
      correct: analysis.correct,
      score: analysis.score,
      topicId: learningSession.topicId ?? undefined,
      analysis: {
        reasoning: analysis.reasoning as any,
        confidence: analysis.confidence as any,
        misconceptions: analysis.misconceptions,
        explanationQuality: analysis.explanationQuality as any,
      },
    });
  }

  if (!parsed.data.advance) {
    return ok({ analysis, currentStep: learningSession.currentStep });
  }

  // Advance to next step
  const nextStep = learningSession.currentStep + 1;
  const finished = nextStep >= steps.length;

  await db.learningSession.update({
    where: { id: sessionId },
    data: {
      currentStep: nextStep,
      status: finished ? "completed" : "active",
      completedAt: finished ? new Date() : null,
    },
  });

  // If finished, update the learning plan item
  if (finished && learningSession.topicId) {
    await db.learningPlanItem.updateMany({
      where: { topicId: learningSession.topicId, plan: { userId: session.user.id } },
      data: { status: "completed" },
    });
    await db.learningPlan.updateMany({
      where: { userId: session.user.id },
      data: { completedTopics: { increment: 1 } },
    });
    await awardXP(session.user.id, "lesson_complete", 50, learningSession.topicId);
  }

  return ok({
    analysis,
    currentStep: finished ? learningSession.currentStep : nextStep,
    finished,
    nextStep: finished ? null : steps[nextStep],
  });
}
