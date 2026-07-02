/**
 * POST /api/auth/logout — revoke session and clear cookies.
 */
import { db } from "@/lib/db";
import { clearAuthCookiesOnResponse, readRefreshToken } from "@/lib/session";
import { ok } from "@/lib/api";

export async function POST() {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    await db.session.updateMany({
      where: { refreshToken },
      data: { revoked: true },
    });
  }
  const response = ok({ loggedOut: true });
  clearAuthCookiesOnResponse(response);
  return response;
}
