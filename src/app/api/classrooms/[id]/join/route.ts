/**
 * POST /api/classrooms/[id]/join — join a classroom by code OR by classroom id (student).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ code: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  let body: unknown = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const classroom = await db.classroom.findUnique({ where: { id } });
  if (!classroom) return ApiError.NotFound("Classroom");
  if (parsed.data.code && parsed.data.code.toUpperCase() !== classroom.code) {
    return ApiError.Validation("Invalid join code");
  }

  const existing = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: id, userId: session.user.id } },
  });
  if (existing) return ApiError.Conflict("Already a member");

  await db.classroomMember.create({
    data: { classroomId: id, userId: session.user.id, role: "student" },
  });
  return ok({ joined: true, classroom: { id, name: classroom.name } });
}
