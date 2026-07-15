/**
 * POST /api/auth/forgot-password
 * Generate a secure, time-limited reset token and email it to the user.
 * Rate-limited to prevent user enumeration and abuse.
 * Stores a HASHED version of the token in the database — the raw token
 * is only present in the emailed link and never persisted.
 */
import { db } from "@/lib/db";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { sendEmail, buildResetEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Rate limiting: track requests per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3; // max requests per window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

/**
 * Hash a reset token using scrypt (same KDF used for passwords).
 * Returns "salt:hash" format for constant-time comparison.
 */
function hashResetToken(token: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(token, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!checkRateLimit(ip)) {
    return ApiError.RateLimited("Too many requests. Please try again later.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return ApiError.Validation("Validation failed", parsed.error.flatten());
  }

  const { email } = parsed.data;

  // Use a generic response to prevent user enumeration
  const genericMessage = "If an account with that email exists, a password reset link has been sent.";

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return ok({ message: genericMessage });
    }

    // Generate raw token (32 random bytes = 64 hex chars)
    const rawToken = randomBytes(32).toString("hex");
    // Store ONLY the hashed version in the database
    const hashedToken = hashResetToken(rawToken);
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Store hashed token in database
    await db.user.update({
      where: { id: user.id },
      data: { resetToken: hashedToken, resetTokenExp },
    });

    // Build reset URL with ONLY the raw token (no email parameter)
    const origin = process.env.NEXTAUTH_URL || req.headers.get("origin") || "http://localhost:3000";
    const resetUrl = `${origin}/reset-password?token=${rawToken}`;

    // Send email
    const html = buildResetEmail(resetUrl, user.name);
    const sent = await sendEmail({
      to: email,
      subject: "Reset your NeuroLearn password",
      html,
    });

    if (!sent) {
      console.error("[FORGOT-PASSWORD] Failed to send email for user:", user.id);
    }

    return ok({ message: genericMessage });
  } catch (err) {
    console.error("[FORGOT-PASSWORD] Error:", err);
    return ok({ message: genericMessage });
  }
}