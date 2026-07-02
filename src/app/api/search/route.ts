/**
 * GET /api/search?q=... — global search across documents, chats, flashcards, lessons, quizzes, courses, skills.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { globalSearch } from "@/lib/search";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (!q.trim()) return ok({ results: [] });
  const results = await globalSearch(session.user.id, q, 25);
  return ok({ query: q, results });
}
