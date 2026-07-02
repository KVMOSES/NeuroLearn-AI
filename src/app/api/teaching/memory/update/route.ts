/**
 * POST /api/teaching/memory/update — update memory retention for a topic.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { updateMemoryState } from "@/lib/teaching";
import { z } from "zod";

const schema = z.object({
  topicId: z.string(),
  quality: z.number().int().min(0).max(5),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  await updateMemoryState(session.user.id, parsed.data.topicId, parsed.data.quality);
  return ok({ updated: true });
}
