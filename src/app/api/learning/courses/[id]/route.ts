/**
 * POST /api/learning/courses/[id]/enroll — enroll the current user in a course.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const { id } = await params;
  const course = await db.course.findUnique({ where: { id } });
  if (!course) return ApiError.NotFound("Course");

  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    create: { userId: session.user.id, courseId: id, progress: 0 },
    update: {},
  });

  return ok({ enrollment: { courseId: enrollment.courseId, progress: enrollment.progress } });
}
