/**
 * POST /api/teaching/diagnostic/submit
 * Submits diagnostic answers, analyzes them, and builds the learner profile.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { analyzeDiagnosticResponses, type DiagnosticQuestion } from "@/lib/teaching";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string(),
  answers: z.array(z.object({
    question: z.any(), // the full DiagnosticQuestion object
    selectedIndex: z.number().int().nullable().optional(),
    textAnswer: z.string().nullable().optional(),
    numericAnswer: z.number().nullable().optional(),
    timeMs: z.number().int().optional().default(0),
  })),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const { sessionId, answers } = parsed.data;

  const diagSession = await db.diagnosticSession.findFirst({
    where: { id: sessionId, userId: session.user.id, status: "active" },
  });
  if (!diagSession) return ApiError.NotFound("Diagnostic session");

  // Grade each answer
  const graded = answers.map((a) => {
    const q = a.question as DiagnosticQuestion;
    let correct = false;
    let score = 0;

    if (q.type === "mcq" || q.type === "truefalse") {
      correct = a.selectedIndex === q.correctIndex;
      score = correct ? 1 : 0;
    } else if (q.type === "numerical") {
      const target = q.numericAnswer ?? 0;
      const tolerance = q.numericTolerance ?? 0.01;
      correct = a.numericAnswer !== null && a.numericAnswer !== undefined && Math.abs(a.numericAnswer - target) <= tolerance;
      score = correct ? 1 : 0;
    } else if (q.type === "short" || q.type === "reasoning") {
      // Simple keyword matching for grading (AI analysis happens in analyzeDiagnosticResponses)
      const accepted = q.correctAnswer ?? [];
      const studentAns = (a.textAnswer ?? "").toLowerCase();
      const matches = accepted.filter((acc) => studentAns.includes(acc.toLowerCase().split(" ").slice(0, 3).join(" ")));
      score = accepted.length > 0 ? Math.min(1, matches.length / Math.max(1, Math.ceil(accepted.length * 0.5))) : 0;
      correct = score >= 0.5;
    }

    return { question: q, selectedIndex: a.selectedIndex ?? undefined, textAnswer: a.textAnswer ?? undefined, numericAnswer: a.numericAnswer ?? undefined, correct, score };
  });

  try {
    const profile = await analyzeDiagnosticResponses(session.user.id, sessionId, graded);

    // Also generate a learning plan based on the new profile
    try {
      const { generateLearningPlan } = await import("@/lib/teaching");
      await generateLearningPlan(session.user.id, diagSession.documentId);
    } catch {
      // plan generation may fail if no topics — non-fatal
    }

    return ok({
      profile: {
        priorKnowledge: Math.round(profile.priorKnowledge * 100),
        conceptualUnderstanding: Math.round(profile.conceptualUnderstanding * 100),
        reasoningAbility: Math.round(profile.reasoningAbility * 100),
        confidence: Math.round(profile.confidence * 100),
        learningSpeed: Math.round(profile.learningSpeed * 100),
        preferredStyle: profile.preferredStyle,
        strengths: profile.strengths,
        weaknesses: profile.weaknesses,
        misconceptions: profile.misconceptions,
      },
      score: Math.round((graded.reduce((s, r) => s + r.score, 0) / graded.length) * 100),
      correctCount: graded.filter((r) => r.correct).length,
      totalQuestions: graded.length,
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Profile analysis failed");
  }
}
