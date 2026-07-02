/**
 * GET /api/ai/conversations/[id] — full conversation with messages
 * DELETE /api/ai/conversations/[id] — delete conversation
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const { id } = await params;
  const conversation = await db.conversation.findFirst({
    where: { id, userId: session.user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return ApiError.NotFound("Conversation");

  return ok({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      context: conversation.context,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        tokensIn: m.tokensIn,
        tokensOut: m.tokensOut,
        createdAt: m.createdAt,
      })),
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const { id } = await params;
  const conversation = await db.conversation.findFirst({ where: { id, userId: session.user.id } });
  if (!conversation) return ApiError.NotFound("Conversation");

  await db.conversation.delete({ where: { id } });
  return ok({ deleted: true });
}
