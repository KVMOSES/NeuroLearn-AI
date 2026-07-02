/**
 * POST /api/courses/[id] — add a module with lessons to a course (author only).
 * PATCH /api/courses/[id] — update course metadata.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

const moduleSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  lessons: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        summary: z.string().default(""),
        content: z.string().default(""),
        durationMin: z.number().int().min(1).default(10),
      })
    )
    .default([]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const course = await db.course.findUnique({ where: { id } });
  if (!course) return ApiError.NotFound("Course");
  if (course.authorId && course.authorId !== session.user.id && session.user.role === "STUDENT") {
    return ApiError.Forbidden("Only the author can edit this course");
  }

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const moduleCount = await db.module.count({ where: { courseId: id } });
  const module_ = await db.module.create({
    data: {
      courseId: id,
      title: parsed.data.title,
      description: parsed.data.description,
      order: moduleCount,
    },
  });

  for (let i = 0; i < parsed.data.lessons.length; i++) {
    const l = parsed.data.lessons[i];
    await db.lesson.create({
      data: {
        moduleId: module_.id,
        title: l.title,
        summary: l.summary,
        content: l.content,
        durationMin: l.durationMin,
        order: i,
      },
    });
  }

  return ok({ moduleId: module_.id, lessonCount: parsed.data.lessons.length }, undefined, 201);
}
