/**
 * POST /api/ai/explain — adaptive concept explanation based on mastery.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { explainConcept } from "@/lib/ai";
import { z } from "zod";

const schema = z.object({
  topic: z.string().min(2).max(200),
  mastery: z.number().min(0).max(1).default(0.5),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const explanation = await explainConcept(parsed.data.topic, parsed.data.mastery);
  return ok({ topic: parsed.data.topic, mastery: parsed.data.mastery, explanation });
}
