/**
 * POST /api/classrooms/[id]/announcements — post an announcement (teacher/admin).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const membership = await db.classroomMember.findFirst({
    where: { classroomId: id, userId: session.user.id },
  });
  if (!membership || membership.role !== "teacher") {
    return ApiError.Forbidden("Only teachers can post announcements");
  }

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const announcement = await db.announcement.create({
    data: {
      classroomId: id,
      authorId: session.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    },
    include: { author: { select: { name: true, avatarUrl: true } } },
  });
  return ok({ announcement }, undefined, 201);
}
