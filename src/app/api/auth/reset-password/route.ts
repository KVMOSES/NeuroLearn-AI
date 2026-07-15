/**
 * POST /api/auth/reset-password
 * Validate reset token against hashed tokens in the database,
 * then hash the new password, revoke ALL active sessions,
 * and invalidate the reset token.
 *
 * Security model:
 * - Raw token is never stored — only a scrypt hash is persisted.
 * - Token is looked up by scanning all users with a non-null resetToken
 *   and performing a constant-time comparison. This avoids exposing
 *   which user is associated with a token (timing-safe enumeration).
 * - All sessions are revoked on password change so old JWTs are useless.
 * - Token is invalidated after successful use or on expiry.
 */
import { db } from "@/lib/db";
import { ok, ApiError } from "@/lib/api";
import { hashPassword, validatePasswordStrength } from "@/lib/auth";
import { scryptSync, timingSafeEqual } from "crypto";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

/**
 * Verify a raw token against a stored "salt:hash" string using constant-time comparison.
 */
function verifyTokenConstantTime(rawToken: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const storedHashBuf = Buffer.from(hash, "hex");
    const computedBuf = scryptSync(rawToken, salt, 64);
    if (storedHashBuf.length !== computedBuf.length) return false;
    return timingSafeEqual(storedHashBuf, computedBuf);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
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

  const { token, password } = parsed.data;

  try {
    // Find ALL users that have a resetToken set — iterate and constant-time compare
    // to prevent timing-based user enumeration.
    const candidates = await db.user.findMany({
      where: { resetToken: { not: null } },
      select: { id: true, email: true, name: true, resetToken: true, resetTokenExp: true, passwordHash: true, failedLogins: true, lockedUntil: true },
    });

    const now = Date.now();
    let matchedUser: (typeof candidates)[number] | null = null;

    for (const u of candidates) {
      if (verifyTokenConstantTime(token, u.resetToken)) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      return ApiError.Validation("Invalid or expired reset link. Please request a new one.");
    }

    // Check if token is expired
    if (!matchedUser.resetTokenExp || matchedUser.resetTokenExp.getTime() < now) {
      // Token expired — clean it up
      await db.user.update({
        where: { id: matchedUser.id },
        data: { resetToken: null, resetTokenExp: null },
      });
      return ApiError.Validation("This reset link has expired. Please request a new one.");
    }

    // Validate new password strength
    const strength = validatePasswordStrength(password);
    if (!strength.ok) {
      return ApiError.Validation("Password is too weak", { reasons: strength.reasons, score: strength.score });
    }

    // Atomically: hash new password, invalidate reset token, revoke ALL active sessions
    const [updatedUser] = await db.$transaction([
      db.user.update({
        where: { id: matchedUser.id },
        data: {
          passwordHash: hashPassword(password),
          resetToken: null,
          resetTokenExp: null,
          failedLogins: 0,
          lockedUntil: null,
        },
      }),
      db.session.updateMany({
        where: { userId: matchedUser.id, revoked: false },
        data: { revoked: true },
      }),
    ]);

    return ok({ message: "Your password has been reset successfully. You can now sign in with your new password." });
  } catch (err) {
    console.error("[RESET-PASSWORD] Error:", err);
    return ApiError.Internal("Password reset failed. Please try again.");
  }
}