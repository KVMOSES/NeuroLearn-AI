/**
 * GET /api/learning/courses — catalog with user enrollment & progress.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const courses = await db.course.findMany({
    where: { published: true },
    orderBy: { createdAt: "asc" },
    include: {
      modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } },
      _count: { select: { enrollments: true } },
    },
  });

  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    select: { courseId: true, progress: true, completedAt: true },
  });
  const enrolledMap = new Map(enrollments.map((e) => [e.courseId, e]));

  // Compute per-lesson progress for the user
  const lessonProgress = await db.lessonProgress.findMany({
    where: { userId: session.user.id },
    select: { lessonId: true, status: true, timeSpent: true, completedAt: true },
  });
  const lpMap = new Map(lessonProgress.map((lp) => [lp.lessonId, lp]));

  return ok({
    courses: courses.map((c) => {
      const enrollment = enrolledMap.get(c.id);
      const lessons = c.modules.flatMap((m) => m.lessons);
      const completedCount = lessons.filter((l) => lpMap.get(l.id)?.status === "completed").length;
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        category: c.category,
        difficulty: c.difficulty,
        color: c.color,
        estimatedHours: c.estimatedHours,
        tags: c.tags ? JSON.parse(c.tags) : [],
        enrolledCount: c._count.enrollments,
        enrolled: !!enrollment,
        progress: enrollment?.progress ?? 0,
        completed: !!enrollment?.completedAt,
        moduleCount: c.modules.length,
        lessonCount: lessons.length,
        completedLessons: completedCount,
        modules: c.modules.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          order: m.order,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            summary: l.summary,
            durationMin: l.durationMin,
            order: l.order,
            status: lpMap.get(l.id)?.status ?? "not_started",
            timeSpent: lpMap.get(l.id)?.timeSpent ?? 0,
            skillId: l.skillId,
          })),
        })),
      };
    }),
  });
}
