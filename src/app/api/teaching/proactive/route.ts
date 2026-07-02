/**
 * GET /api/teaching/proactive — proactive coaching messages from Atlas.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { getProactiveMessages } from "@/lib/atlas-engine";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const messages = await getProactiveMessages(session.user.id);
  return ok({ messages });
}
