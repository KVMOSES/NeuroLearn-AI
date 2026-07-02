/**
 * GET /api/classrooms/by-code?code=XXX — look up a classroom by its join code (for students).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").toUpperCase();
  if (!code) return ApiError.Validation("Code is required");

  const classroom = await db.classroom.findUnique({
    where: { code },
    include: {
      owner: { select: { name: true, avatarUrl: true } },
      _count: { select: { members: true, courses: true } },
    },
  });
  if (!classroom) return ApiError.NotFound("Classroom not found");

  const membership = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId: session.user.id } },
  });

  return ok({
    classroom: {
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      code: classroom.code,
      owner: classroom.owner,
      memberCount: classroom._count.members,
      courseCount: classroom._count.courses,
      alreadyMember: !!membership,
      role: membership?.role ?? null,
    },
  });
}
