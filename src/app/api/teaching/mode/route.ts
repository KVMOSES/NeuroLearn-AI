/**
 * GET /api/teaching/mode — get available teaching modes and current selection.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { TEACHING_MODES, resolveTeachingMode } from "@/lib/learning-dna";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const profile = await db.learnerProfile.findUnique({ where: { userId: session.user.id } });
  const currentMode = profile?.teachingMode ?? "auto";
  const effectiveMode = await resolveTeachingMode(session.user.id);

  return ok({
    modes: TEACHING_MODES,
    currentMode,
    effectiveMode,
  });
}
