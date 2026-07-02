/**
 * GET /api/ai/conversations — list user's conversations
 * POST /api/ai/conversations — create a new conversation
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const conversations = await db.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
    take: 50,
  });

  return ok({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      context: c.context,
      messageCount: c._count.messages,
      updatedAt: c.updatedAt,
    })),
  });
}

const createSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const conversation = await db.conversation.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title ?? "New Conversation",
      context: parsed.data.context ? JSON.stringify(parsed.data.context) : null,
    },
  });

  return ok({ conversation: { id: conversation.id, title: conversation.title } });
}
