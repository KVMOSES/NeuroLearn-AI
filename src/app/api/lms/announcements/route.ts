/**
 * GET /api/lms/announcements — recent announcements for the user's classrooms.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const memberships = await db.classroomMember.findMany({
    where: { userId: session.user.id },
    select: { classroomId: true },
  });
  const classroomIds = memberships.map((m) => m.classroomId);

  const announcements = await db.announcement.findMany({
    where: { OR: [{ classroomId: { in: classroomIds } }, { classroomId: null }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { author: { select: { name: true, avatarUrl: true } }, classroom: { select: { name: true } } },
  });

  return ok({
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      author: a.author,
      classroom: a.classroom?.name ?? null,
    })),
  });
}
