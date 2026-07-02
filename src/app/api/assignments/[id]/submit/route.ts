/**
 * POST /api/assignments/[id]/submit — student submits an assignment.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";
import { awardXP } from "@/lib/gamification";

const schema = z.object({
  content: z.string().min(1).max(20000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const assignment = await db.assignment.findUnique({ where: { id } });
  if (!assignment) return ApiError.NotFound("Assignment");

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const existing = await db.submission.findFirst({
    where: { assignmentId: id, userId: session.user.id },
  });
  if (existing) {
    const updated = await db.submission.update({
      where: { id: existing.id },
      data: { content: parsed.data.content, status: "submitted", submittedAt: new Date(), score: null, feedback: null, gradedAt: null },
    });
    return ok({ submission: updated });
  }

  const submission = await db.submission.create({
    data: { assignmentId: id, userId: session.user.id, content: parsed.data.content },
  });
  await awardXP(session.user.id, "lesson_complete", 30, id);
  return ok({ submission }, undefined, 201);
}
