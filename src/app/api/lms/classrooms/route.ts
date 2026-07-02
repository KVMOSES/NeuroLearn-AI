/**
 * GET /api/lms/classrooms — classrooms for the current user.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const memberships = await db.classroomMember.findMany({
    where: { userId: session.user.id },
    include: {
      classroom: {
        include: {
          owner: { select: { name: true } },
          _count: { select: { members: true, assignments: true, courses: true } },
        },
      },
    },
  });

  return ok({
    classrooms: memberships.map((m) => ({
      id: m.classroom.id,
      name: m.classroom.name,
      description: m.classroom.description,
      code: m.classroom.code,
      role: m.role,
      owner: m.classroom.owner.name,
      memberCount: m.classroom._count.members,
      assignmentCount: m.classroom._count.assignments,
      courseCount: m.classroom._count.courses,
    })),
  });
}
