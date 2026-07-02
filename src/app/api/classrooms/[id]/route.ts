/**
 * GET /api/classrooms/[id] — classroom detail (members, assignments, announcements, courses)
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const membership = await db.classroomMember.findFirst({
    where: { classroomId: id, userId: session.user.id },
  });
  if (!membership) return ApiError.Forbidden("You are not a member of this classroom");

  const classroom = await db.classroom.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true, level: true, totalXP: true } } }, orderBy: { joinedAt: "asc" } },
      assignments: { orderBy: { dueDate: "asc" } },
      announcements: { include: { author: { select: { name: true, avatarUrl: true } } }, orderBy: { createdAt: "desc" } },
      courses: { include: { course: true } },
    },
  });
  if (!classroom) return ApiError.NotFound("Classroom");

  // For students, include their own submission status per assignment
  const submissions = await db.submission.findMany({
    where: { userId: session.user.id, assignment: { classroomId: id } },
  });
  const submissionMap = new Map(submissions.map((s) => [s.assignmentId, s]));

  return ok({
    classroom: {
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      code: classroom.code,
      role: membership.role,
      owner: classroom.owner,
      members: classroom.members.map((m) => ({ ...m.user, memberRole: m.role, joinedAt: m.joinedAt })),
      assignments: classroom.assignments.map((a) => {
        const sub = submissionMap.get(a.id);
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate,
          maxScore: a.maxScore,
          mySubmission: sub ? { status: sub.status, score: sub.score, feedback: sub.feedback } : null,
        };
      }),
      announcements: classroom.announcements,
      courses: classroom.courses.map((cc) => cc.course),
    },
  });
}
