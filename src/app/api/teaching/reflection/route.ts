/**
 * POST /api/teaching/reflection — generate a session reflection.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateSessionReflection } from "@/lib/atlas-engine";
import { z } from "zod";

const schema = z.object({
  xpEarned: z.number().default(0),
  timeSpentMinutes: z.number().default(0),
  topicIds: z.array(z.string()).default([]),
  quizScores: z.array(z.number()).default([]),
  correctAnswers: z.number().default(0),
  totalAnswers: z.number().default(0),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const reflection = await generateSessionReflection(session.user.id, parsed.data);
  return ok({ reflection });
}
