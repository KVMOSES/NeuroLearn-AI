/**
 * POST /api/courses — create a course (TEACHER/ADMIN only).
 * GET  /api/courses — list courses (optional unpublished for author).
 */
import { db } from "@/lib/db";
import { getSession, requireRole } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

const createSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(1000),
  category: z.string().min(1).max(60),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  color: z.enum(["violet", "emerald", "amber", "rose", "cyan"]).default("violet"),
  estimatedHours: z.number().int().min(0).default(10),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("TEACHER", "ADMIN");
  } catch (e: any) {
    return ApiError.Forbidden(e.message);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  let slug = slugify(parsed.data.title);
  // ensure unique slug
  let suffix = 1;
  while (await db.course.findUnique({ where: { slug } })) {
    slug = `${slugify(parsed.data.title)}-${suffix++}`;
  }

  const course = await db.course.create({
    data: {
      slug,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      difficulty: parsed.data.difficulty,
      color: parsed.data.color,
      estimatedHours: parsed.data.estimatedHours,
      authorId: session.user.id,
    },
  });
  return ok({ course }, undefined, 201);
}
