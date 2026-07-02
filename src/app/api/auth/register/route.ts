/**
 * POST /api/auth/register
 * Creates a new user, sets auth cookies, starts a session.
 */
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength, signRefreshToken } from "@/lib/auth";
import { attachAuthCookies } from "@/lib/session";
import { registerSchema } from "@/lib/validators";
import { ok, ApiError } from "@/lib/api";
import { awardXP } from "@/lib/gamification";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.Validation("Validation failed", parsed.error.flatten());
  }
  const { name, email, password, role } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    return ApiError.Validation("Password is too weak", { reasons: strength.reasons, score: strength.score });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return ApiError.Conflict("An account with this email already exists");
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      verifyToken: randomUUID(),
      verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const { token: refreshToken, expiresAt } = await signRefreshToken(user.id);
  await db.session.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
  });

  const response = ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  await attachAuthCookies(
    response,
    user.id,
    user.email,
    user.role,
    user.name,
    refreshToken,
    expiresAt,
    req
  );
  return response;
}
