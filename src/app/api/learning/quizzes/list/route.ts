/**
 * GET /api/learning/quizzes/list — list quizzes (catalog + user-authored + from documents).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const quizzes = await db.quiz.findMany({
    where: {
      OR: [
        { authorId: session.user.id },
        { document: { userId: session.user.id } },
        { lesson: { module: { course: { published: true } } } },
      ],
    },
    include: {
      _count: { select: { questions: true } },
      document: { select: { id: true, title: true } },
      skill: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ok({
    quizzes: quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      questionCount: q._count.questions,
      document: q.document,
      skill: q.skill,
      createdAt: q.createdAt,
    })),
  });
}
