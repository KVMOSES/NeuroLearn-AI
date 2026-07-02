/**
 * GET /api/teaching/companion — get current companion + available companions.
 * POST /api/teaching/companion — set companion.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { COMPANIONS } from "@/lib/companions";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const profile = await db.learnerProfile.findUnique({ where: { userId: session.user.id } });
  const currentCompanion = profile?.companion ?? "nova";

  return ok({
    companions: COMPANIONS.map((c) => ({
      key: c.key,
      name: c.name,
      title: c.title,
      icon: c.icon,
      color: c.color,
      gradient: c.gradient,
      description: c.description,
      greeting: c.greeting,
    })),
    currentCompanion,
  });
}

const schema = z.object({
  companion: z.enum(["nova", "atlas", "sage", "spark"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  await db.learnerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, companion: parsed.data.companion },
    update: { companion: parsed.data.companion, lastUpdated: new Date() },
  });

  return ok({ companion: parsed.data.companion });
}
