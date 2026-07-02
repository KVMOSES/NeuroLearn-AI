/**
 * GET /api/knowledge/graph — skill nodes + prerequisite edges with user mastery.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { getKnowledgeGraph } from "@/lib/learning-service";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const graph = await getKnowledgeGraph(session.user.id);
  return ok(graph);
}
