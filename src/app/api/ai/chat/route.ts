/**
 * POST /api/ai/chat — streaming AI tutor via Server-Sent Events.
 *
 * Supports two modes:
 *   - rag: true  → retrieve relevant doc chunks, ground the answer, return citations
 *   - rag: false → standard adaptive tutor chat
 *
 * Sends SSE events: { type: 'token'|'citation'|'done'|'error', ... }
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { z } from "zod";
import { streamText, estimateTokens, estimateCost, persistMessage, tutorChat, AIError, type ChatTurn } from "@/lib/ai";
import { retrieve } from "@/lib/rag";
import { awardXP } from "@/lib/gamification";

async function buildTutorSystemPrompt(userId: string, rag: boolean): Promise<string> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  const prior = profile?.priorKnowledge ?? 0.3;
  const misconceptions = profile?.misconceptions ? JSON.parse(profile.misconceptions) : [];
  const strengths = profile?.strengths ? JSON.parse(profile.strengths) : [];
  const weaknesses = profile?.weaknesses ? JSON.parse(profile.weaknesses) : [];
  const mistakePatterns = profile?.mistakePatterns ? JSON.parse(profile.mistakePatterns) : [];

  // Resolve teaching mode from Learning DNA
  const { resolveTeachingMode, getTeachingModePrompt } = await import("@/lib/learning-dna");
  const effectiveMode = await resolveTeachingMode(userId);

  const dnaPrompt = getTeachingModePrompt(effectiveMode, {
    priorKnowledge: prior,
    reasoningAbility: profile?.reasoningAbility ?? 0.3,
    confidence: profile?.confidence ?? 0.5,
    learningSpeed: profile?.learningSpeed ?? 0.5,
    visualPreference: profile?.visualPreference ?? 0.5,
    readingPreference: profile?.readingPreference ?? 0.5,
    strengths,
    weaknesses,
    misconceptions,
    mistakePatterns,
  });

  const base = `You are NeuroTutor, a personal AI Teacher that adapts to how each student learns. You are NOT a chatbot — you are a mentor.

${dnaPrompt}
- Generate examples, analogies, and practice questions naturally.
- Use Markdown formatting.
- Keep explanations concise but thorough.
- If the student is struggling, simplify. If they're excelling, push deeper.
- Never reveal that you are a generic model; you are NeuroTutor.`;

  // Add Atlas Intelligence Engine: conversation memory + teaching instructions
  const { getConversationMemoryPrompt, getTeachingInstructions } = await import("@/lib/atlas-engine");
  const [conversationMemory, teachingInstructions] = await Promise.all([
    getConversationMemoryPrompt(userId),
    Promise.resolve(getTeachingInstructions({
      priorKnowledge: prior,
      reasoningAbility: profile?.reasoningAbility ?? 0.3,
      confidence: profile?.confidence ?? 0.5,
      learningSpeed: profile?.learningSpeed ?? 0.5,
      visualPreference: profile?.visualPreference ?? 0.5,
      misconceptions,
      mistakePatterns,
    })),
  ]);

  // Add companion personality
  const { getCompanion } = await import("@/lib/companions");
  const companion = getCompanion(profile?.companion ?? "nova");
  const companionPrompt = `\n\nCOMPANION PERSONALITY: ${companion.systemPromptAddition}`;
  const atlasEnhancement = teachingInstructions + conversationMemory;

  if (rag) {
    return base + companionPrompt + atlasEnhancement + `

Source excerpts from the user's documents are provided as numbered citations like [1], [2].
Rules:
- Ground your answer in the excerpts when relevant.
- Cite sources inline using bracket notation, e.g. "Backprop applies the chain rule [1]."
- If excerpts don't cover it, answer from general knowledge and note "No document covered this."
- Never invent citations.`;
  }
  return base + companionPrompt + atlasEnhancement;
}

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  rag: z.boolean().optional().default(false),
  documentId: z.string().optional(),
  context: z
    .object({
      skillId: z.string().optional(),
      lessonId: z.string().optional(),
      courseId: z.string().optional(),
    })
    .optional(),
});

function formatAIError(err: unknown): string {
  if (err instanceof AIError) return err.message;
  if (err instanceof Error) return err.message;
  return "AI request failed";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON body"); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const { message, conversationId, rag, documentId, context } = parsed.data;

  // Resolve or create conversation
  let conversation = conversationId
    ? await db.conversation.findFirst({ where: { id: conversationId, userId: session.user.id } })
    : null;
  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        userId: session.user.id,
        title: message.slice(0, 60),
        context: context ? JSON.stringify(context) : null,
      },
    });
  }

  // Load history
  const historyRows = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 16,
  });
  const history: ChatTurn[] = historyRows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const userTokens = estimateTokens(message);
  await persistMessage(conversation.id, "user", message, userTokens, 0);

  // RAG retrieval (if requested)
  let retrieval: { context: string; citations: any[] } | null = null;
  if (rag) {
    retrieval = await retrieve(session.user.id, message, documentId ? { documentId } : {});
  }

  const contextBlock = context
    ? `Current focus: ${context.skillId ? "skill " + context.skillId : ""}${context.lessonId ? ", lesson " + context.lessonId : ""}`.trim()
    : "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let assistantText = "";

      try {
        // Send citations up-front if RAG
        if (retrieval && retrieval.citations.length > 0) {
          send({ type: "citations", citations: retrieval.citations });
        }

        const systemPrompt = await buildTutorSystemPrompt(session.user.id, !!(retrieval && retrieval.context)) + (contextBlock ? `\n\n${contextBlock}` : "");

        const userContent = retrieval && retrieval.context
          ? `Source excerpts:\n\n${retrieval.context}\n\n---\n\nUser question: ${message}`
          : message;

        const fullMessages: ChatTurn[] = [
          { role: "system", content: systemPrompt },
          ...history.slice(-6),
          { role: "user", content: userContent },
        ];

        let streamed = false;
        try {
          for await (const delta of streamText(fullMessages)) {
            assistantText += delta;
            streamed = true;
            send({ type: "token", value: delta });
          }
        } catch {
          send({ type: "info", value: "Switching to standard mode…" });
        }

        if (!streamed || assistantText.length === 0) {
          assistantText = await tutorChat(history, userContent, contextBlock);
          const words = assistantText.split(/(\s+)/);
          for (const w of words) {
            if (w) send({ type: "token", value: w });
            await new Promise((r) => setTimeout(r, 10));
          }
        }

        const outTokens = estimateTokens(assistantText);
        const citationsJson = retrieval && retrieval.citations.length > 0
          ? JSON.stringify(retrieval.citations)
          : null;
        await db.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: assistantText,
            citations: citationsJson,
            tokensIn: userTokens,
            tokensOut: outTokens,
            costEstimate: estimateCost(userTokens, outTokens),
          },
        });
        await awardXP(session.user.id, "chat_message");

        // Atlas Intelligence Engine: summarize conversation for durable memory (every 6+ messages)
        const messageCount = await db.message.count({ where: { conversationId: conversation.id } });
        if (messageCount >= 6 && messageCount % 6 === 0) {
          // Non-blocking — don't delay the response
          const { summarizeConversation } = await import("@/lib/atlas-engine");
          const recentMessages = await db.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            take: 12,
            select: { role: true, content: true },
          });
          summarizeConversation(session.user.id, conversation.id, recentMessages).catch(() => {});
        }

        send({
          type: "done",
          conversationId: conversation.id,
          tokensIn: userTokens,
          tokensOut: outTokens,
          cost: estimateCost(userTokens, outTokens),
          citations: retrieval?.citations ?? [],
        });
      } catch (err) {
        send({ type: "error", message: formatAIError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
