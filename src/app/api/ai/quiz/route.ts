/**
 * POST /api/ai/quiz — generate an adaptive quiz for a topic using AI.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateQuiz } from "@/lib/ai";
import { z } from "zod";
import { awardXP } from "@/lib/gamification";

const schema = z.object({
  topic: z.string().min(2).max(200),
  count: z.number().int().min(1).max(10).default(4),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  persist: z.boolean().default(true),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const { topic, count, difficulty, persist } = parsed.data;
  const questions = await generateQuiz(topic, count, difficulty);
  if (questions.length === 0) {
    return ApiError.Internal("Failed to generate quiz questions");
  }

  let quizId: string | null = null;
  if (persist) {
    // Find or create a skill for the topic (SQLite is case-insensitive for contains by default)
    let skill = await db.skill.findFirst({ where: { name: { contains: topic } } });
    if (!skill) {
      skill = await db.skill.create({ data: { name: topic, category: "Generated", description: `Generated for ${topic}` } });
    }
    const quiz = await db.quiz.create({
      data: {
        title: `AI Quiz: ${topic}`,
        description: `Auto-generated ${difficulty} quiz`,
        skillId: skill.id,
        difficulty,
      },
    });
    for (const q of questions) {
      await db.question.create({
        data: {
          quizId: quiz.id,
          prompt: q.prompt,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          difficulty: q.difficulty,
          skillId: skill.id,
        },
      });
    }
    quizId = quiz.id;
    await awardXP(session.user.id, "document_upload", 0); // touch streak without xp
  }

  return ok({
    quizId,
    topic,
    difficulty,
    questions: questions.map((q, i) => ({
      id: `gen-${i}`,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      difficulty: q.difficulty,
    })),
  });
}
