/**
 * POST /api/auth/login
 * Authenticates a user, enforces account lockout, sets cookies.
 */
import { db } from "@/lib/db";
import { verifyPassword, signRefreshToken, isAccountLocked, lockoutExpiry, MAX_FAILED_LOGINS } from "@/lib/auth";
import { attachAuthCookies } from "@/lib/session";
import { loginSchema } from "@/lib/validators";
import { ok, ApiError } from "@/lib/api";
import { updateStreak } from "@/lib/gamification";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.Validation("Validation failed", parsed.error.flatten());
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return ApiError.Unauthorized("Invalid email or password");
  }

  if (isAccountLocked(user.lockedUntil)) {
    return ApiError.Forbidden("Account is temporarily locked. Try again later.");
  }

  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil: lock ? lockoutExpiry() : null,
      },
    });
    return ApiError.Unauthorized("Invalid email or password");
  }

  // Reset failed logins, issue session
  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastActivityDate: new Date() },
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

  await updateStreak(user.id, 0);

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
