/**
 * POST /api/classrooms/[id]/assignments — create an assignment (teacher).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  dueDate: z.string().transform((s) => new Date(s)),
  maxScore: z.number().int().min(1).max(1000).default(100),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const membership = await db.classroomMember.findFirst({
    where: { classroomId: id, userId: session.user.id },
  });
  if (!membership || membership.role !== "teacher") {
    return ApiError.Forbidden("Only teachers can create assignments");
  }

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const assignment = await db.assignment.create({
    data: {
      classroomId: id,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate,
      maxScore: parsed.data.maxScore,
    },
  });
  return ok({ assignment }, undefined, 201);
}
