/**
 * POST /api/lesson-studio/course
 * Generate a complete structured course from a document.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateCourse } from "@/lib/lesson-studio";
import { awardXP } from "@/lib/gamification";
import { z } from "zod";

const schema = z.object({
  documentId: z.string(),
  persist: z.boolean().default(true),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const course = await generateCourse(parsed.data.documentId);

    if (parsed.data.persist) {
      // Create a Course record from the generated structure
      const doc = await db.document.findFirst({ where: { id: parsed.data.documentId, userId: session.user.id } });
      if (doc) {
        const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
        const dbCourse = await db.course.create({
          data: {
            slug: `${slug}-${Date.now().toString(36)}`,
            title: course.title,
            description: course.description,
            category: "AI Generated",
            difficulty: "intermediate",
            color: "violet",
            estimatedHours: course.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l.estimatedMinutes, 0), 0) / 60,
            authorId: session.user.id,
          },
        });

        for (let mi = 0; mi < course.modules.length; mi++) {
          const m = course.modules[mi];
          const module_ = await db.module.create({
            data: { courseId: dbCourse.id, title: m.title, description: m.summary, order: mi },
          });
          for (let li = 0; li < m.lessons.length; li++) {
            const l = m.lessons[li];
            await db.lesson.create({
              data: {
                moduleId: module_.id,
                title: l.title,
                summary: l.summary,
                content: l.objectives.map((o) => `- ${o}`).join("\n"),
                durationMin: l.estimatedMinutes,
                order: li,
              },
            });
          }
        }

        await awardXP(session.user.id, "document_upload", 50, dbCourse.id);
      }
    }

    return ok({ course });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Generation failed");
  }
}
