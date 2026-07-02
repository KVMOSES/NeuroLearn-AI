/**
 * GET /api/teaching/dna — get the user's Learning DNA profile.
 * POST /api/teaching/dna — update teaching mode preference.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { getLearningDNA } from "@/lib/learning-dna";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const dna = await getLearningDNA(session.user.id);
  return ok({ dna });
}

const modeSchema = z.object({
  mode: z.enum(["auto", "professor", "friendly", "exam", "interview", "motivational", "visual", "socratic", "beginner", "advanced"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = modeSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  await db.learnerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, teachingMode: parsed.data.mode },
    update: { teachingMode: parsed.data.mode, lastUpdated: new Date() },
  });

  return ok({ mode: parsed.data.mode });
}
