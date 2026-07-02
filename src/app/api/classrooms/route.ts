/**
 * GET  /api/classrooms — list user's classrooms
 * POST /api/classrooms — create a classroom (TEACHER/ADMIN)
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";
import { randomBytes } from "crypto";

function classCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const memberships = await db.classroomMember.findMany({
    where: { userId: session.user.id },
    include: {
      classroom: {
        include: {
          owner: { select: { name: true, avatarUrl: true } },
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
      owner: m.classroom.owner,
      memberCount: m.classroom._count.members,
      assignmentCount: m.classroom._count.assignments,
      courseCount: m.classroom._count.courses,
      createdAt: m.classroom.createdAt,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  if (session.user.role === "STUDENT") return ApiError.Forbidden("Only teachers and admins can create classrooms");

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  let code = classCode();
  while (await db.classroom.findUnique({ where: { code } })) code = classCode();

  const classroom = await db.classroom.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      code,
      ownerId: session.user.id,
    },
  });
  await db.classroomMember.create({
    data: { classroomId: classroom.id, userId: session.user.id, role: "teacher" },
  });

  return ok({
    classroom: {
      id: classroom.id,
      name: classroom.name,
      code: classroom.code,
      description: classroom.description,
    },
  }, undefined, 201);
}
