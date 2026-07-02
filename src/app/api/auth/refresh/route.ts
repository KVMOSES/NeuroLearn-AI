/**
 * POST /api/auth/refresh — rotate refresh token, issue new access token.
 */
import { db } from "@/lib/db";
import { signRefreshToken } from "@/lib/auth";
import { attachAuthCookies, readRefreshToken } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function POST(req: Request) {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return ApiError.Unauthorized("No refresh token");

  const session = await db.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });
  if (!session || session.revoked || session.expiresAt < new Date()) {
    return ApiError.Unauthorized("Session expired");
  }

  // Rotate: revoke old, issue new
  await db.session.update({
    where: { id: session.id },
    data: { revoked: true },
  });
  const { token: newRefresh, expiresAt } = await signRefreshToken(session.userId);
  await db.session.create({
    data: {
      userId: session.userId,
      refreshToken: newRefresh,
      expiresAt,
      userAgent: session.userAgent,
    },
  });

  const response = ok({ refreshed: true });
  await attachAuthCookies(
    response,
    session.user.id,
    session.user.email,
    session.user.role,
    session.user.name,
    newRefresh,
    expiresAt,
    req
  );
  return response;
}
