/**
 * AI service — wraps @google/genai for chat completions, quiz generation,
 * explanations, and document understanding. Server-side only.
 */
import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/db";

export const GEMINI_MODEL = "gemini-2.5-flash";

export type AIErrorCode =
  | "invalid_api_key"
  | "empty_response"
  | "rate_limit"
  | "network"
  | "malformed_json"
  | "unknown";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AIError";
  }
}

let aiClient: GoogleGenAI | null = null;

export async function getAI(): Promise<GoogleGenAI> {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AIError("invalid_api_key", "GEMINI_API_KEY is not configured.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Strip markdown code fences from model output. */
export function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json|JSON)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .replace(/```json|```/g, "")
    .trim();
}

/** Parse JSON from model text with fence stripping and substring extraction fallback. */
export function parseModelJSON<T>(raw: string): T {
  const cleaned = stripMarkdownFences(raw);
  if (!cleaned) {
    throw new AIError("empty_response", "Model returned an empty response.");
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        // fall through
      }
    }
    throw new AIError(
      "malformed_json",
      err instanceof Error ? err.message : "Failed to parse JSON from model response."
    );
  }
}

/** Safe JSON parse — returns null instead of throwing. */
export function tryParseModelJSON<T>(raw: string): T | null {
  try {
    return parseModelJSON<T>(raw);
  } catch {
    return null;
  }
}

function classifyGeminiError(err: unknown): AIError {
  if (err instanceof AIError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const status =
    err && typeof err === "object" && "status" in err
      ? (err as { status?: number }).status
      : undefined;

  if (status === 401 || status === 403 || /api.?key|unauthorized|permission/i.test(message)) {
    return new AIError("invalid_api_key", "Invalid or missing Gemini API key.");
  }
  if (status === 429 || /rate.?limit|quota|resource.?exhausted/i.test(message)) {
    return new AIError("rate_limit", "Gemini rate limit exceeded. Please try again shortly.");
  }
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(message)) {
    return new AIError("network", "Network error while contacting Gemini. Please try again.");
  }
  return new AIError("unknown", message || "An unexpected AI error occurred.");
}

function splitMessages(messages: ChatTurn[]): {
  systemInstruction?: string;
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
} {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const conversation = messages.filter((m) => m.role !== "system");

  const contents = conversation.map((m) => ({
    role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
    parts: [{ text: m.content }],
  }));

  return {
    systemInstruction: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    contents,
  };
}

/** Generate plain text from chat messages. */
export async function generateText(messages: ChatTurn[]): Promise<string> {
  try {
    const ai = await getAI();
    const { systemInstruction, contents } = splitMessages(messages);

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    const text = response.text?.trim() ?? "";
    if (!text) {
      throw new AIError("empty_response", "Gemini returned an empty response.");
    }
    return text;
  } catch (err) {
    throw classifyGeminiError(err);
  }
}

/** Generate and parse JSON from chat messages, retrying once on parse failure. */
export async function generateJSON<T>(
  messages: ChatTurn[],
  options: { jsonRetryPrompt?: string } = {}
): Promise<{ data: T | null; error?: AIError }> {
  try {
    let raw = await generateText(messages);
    let parsed = tryParseModelJSON<T>(raw);

    if (parsed === null && options.jsonRetryPrompt) {
      raw = await generateText([
        ...messages,
        { role: "assistant", content: raw },
        { role: "user", content: options.jsonRetryPrompt },
      ]);
      parsed = tryParseModelJSON<T>(raw);
    } else if (parsed === null) {
      raw = await generateText([
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "Your previous response was not valid JSON. Return ONLY valid JSON with no markdown fences or commentary.",
        },
      ]);
      parsed = tryParseModelJSON<T>(raw);
    }

    if (parsed === null) {
      return {
        data: null,
        error: new AIError("malformed_json", "Failed to parse JSON from model response after retry."),
      };
    }
    return { data: parsed };
  } catch (err) {
    const aiErr = classifyGeminiError(err);
    return { data: null, error: aiErr };
  }
}

/** Stream text tokens from chat messages. */
export async function* streamText(messages: ChatTurn[]): AsyncGenerator<string> {
  const ai = await getAI();
  const { systemInstruction, contents } = splitMessages(messages);

  try {
    const responseStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    let yielded = false;
    for await (const chunk of responseStream) {
      const delta = chunk.text ?? "";
      if (delta) {
        yielded = true;
        yield delta;
      }
    }
    if (!yielded) {
      throw new AIError("empty_response", "Gemini returned an empty streamed response.");
    }
  } catch (err) {
    throw classifyGeminiError(err);
  }
}

const TUTOR_SYSTEM_PROMPT = `You are NeuroTutor, the AI learning assistant inside the NeuroLearn AI adaptive learning platform.

Guidelines:
- Be concise, friendly, and pedagogically sound.
- Use Markdown formatting with headings, bold, lists, and inline code where helpful.
- When a learner is struggling, scaffold the explanation and end with a small check-for-understanding question.
- When a learner is confident, push them toward harder applications and edge cases.
- Reference concrete examples and analogies.
- Never reveal that you are a generic model; you are NeuroTutor.
- If asked something outside learning, gently steer back to the learning context.`;

export async function tutorChat(history: ChatTurn[], userMessage: string, context?: string): Promise<string> {
  const contextBlock = context ? `\n\n[Current learning context]\n${context}\n` : "";
  const messages: ChatTurn[] = [
    { role: "system", content: TUTOR_SYSTEM_PROMPT + contextBlock },
    ...history.slice(-8),
    { role: "user", content: userMessage },
  ];
  try {
    return await generateText(messages);
  } catch (err) {
    const aiErr = classifyGeminiError(err);
    if (aiErr.code === "invalid_api_key") {
      return "AI service is not configured. Please set GEMINI_API_KEY.";
    }
    return "I'm sorry, I couldn't generate a response. Please try again.";
  }
}

/**
 * Generate an adaptive quiz for a skill/topic. Returns structured JSON.
 */
export interface GeneratedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: number; // 0..1
}

export async function generateQuiz(topic: string, count: number, difficulty: string): Promise<GeneratedQuestion[]> {
  const system = `You are a quiz generator for an adaptive learning platform. Generate multiple choice questions as strict JSON.`;
  const user = `Generate ${count} multiple-choice questions about "${topic}" at ${difficulty} difficulty.

Return ONLY a JSON array (no markdown, no commentary) with this exact shape:
[
  {
    "prompt": "string",
    "options": ["a","b","c","d"],
    "correctIndex": 0,
    "explanation": "string",
    "difficulty": 0.5
  }
]

Rules:
- Exactly 4 options per question.
- correctIndex is 0-based.
- difficulty is a float 0..1 (0.1 very easy, 0.9 very hard).
- ${difficulty === "hard" ? "Aim difficulty 0.7-0.9" : difficulty === "easy" ? "Aim difficulty 0.1-0.4" : "Aim difficulty 0.4-0.7"}.`;

  const { data, error } = await generateJSON<GeneratedQuestion[]>([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  if (error || !data) return [];
  return Array.isArray(data) ? data : [];
}

/**
 * Explain a concept adaptively based on mastery level.
 */
export async function explainConcept(topic: string, mastery: number): Promise<string> {
  const level = mastery > 0.75 ? "advanced practitioner" : mastery > 0.4 ? "intermediate" : "beginner";
  try {
    return await generateText([
      {
        role: "system",
        content: `You explain concepts to a learner at the ${level} level. Be clear, use analogies, and keep it under 300 words. Use Markdown.`,
      },
      { role: "user", content: `Explain: ${topic}` },
    ]);
  } catch {
    return "";
  }
}

/**
 * Summarize / extract understanding from uploaded document text.
 */
export async function summarizeDocument(text: string): Promise<string> {
  const truncated = text.slice(0, 12000);
  try {
    return await generateText([
      {
        role: "system",
        content: "Summarize the following document into key learning points in Markdown. Max 250 words.",
      },
      { role: "user", content: truncated },
    ]);
  } catch {
    return "";
  }
}

/**
 * Track usage/cost estimate per message.
 */
export function estimateCost(tokensIn: number, tokensOut: number): number {
  const inRate = 0.15;
  const outRate = 0.6;
  return (tokensIn / 1_000_000) * inRate + (tokensOut / 1_000_000) * outRate;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function persistMessage(
  conversationId: string,
  role: string,
  content: string,
  tokensIn = 0,
  tokensOut = 0
) {
  await db.message.create({
    data: {
      conversationId,
      role,
      content,
      tokensIn,
      tokensOut,
      costEstimate: estimateCost(tokensIn, tokensOut),
    },
  });
}
