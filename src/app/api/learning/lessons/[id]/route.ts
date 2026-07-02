/**
 * GET /api/learning/lessons/[id] — full lesson content + flashcards + skill.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      skill: true,
      flashcards: true,
      module: { include: { course: true } },
      quizzes: { include: { _count: { select: { questions: true } } } },
    },
  });
  if (!lesson) return ApiError.NotFound("Lesson");

  const progress = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: session.user.id, lessonId: id } },
  });

  return ok({
    lesson: {
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      content: lesson.content,
      durationMin: lesson.durationMin,
      skill: lesson.skill ? { id: lesson.skill.id, name: lesson.skill.name } : null,
      course: { id: lesson.module.course.id, title: lesson.module.course.title, slug: lesson.module.course.slug },
      flashcards: lesson.flashcards.map((f) => ({ id: f.id, front: f.front, back: f.back, hint: f.hint })),
      quizzes: lesson.quizzes.map((q) => ({ id: q.id, title: q.title, questionCount: q._count.questions })),
      status: progress?.status ?? "not_started",
      timeSpent: progress?.timeSpent ?? 0,
    },
  });
}
