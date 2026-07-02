/**
 * Session helpers — get current user from request cookies.
 */
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  verifyAccessToken,
  signAccessToken,
  authCookieOptions,
} from "@/lib/auth";
import type { User } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

function toSessionUser(dbUser: User): SessionUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

async function headerGetter() {
  const headerStore = await headers();
  return (name: string) => headerStore.get(name);
}

async function sessionFromAccess(access: string): Promise<{ user: SessionUser; dbUser: User } | null> {
  const payload = await verifyAccessToken(access);
  if (!payload || payload.type !== "access" || !payload.sub) return null;

  const dbUser = await db.user.findUnique({ where: { id: payload.sub } });
  if (!dbUser) return null;

  return { user: toSessionUser(dbUser), dbUser };
}

async function sessionFromRefresh(refreshToken: string): Promise<{ user: SessionUser; dbUser: User } | null> {
  const dbSession = await db.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });
  if (!dbSession || dbSession.revoked || dbSession.expiresAt < new Date()) {
    return null;
  }

  const dbUser = dbSession.user;
  const access = await signAccessToken({
    sub: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    name: dbUser.name,
  });

  const cookieStore = await cookies();
  const getHeader = await headerGetter();
  cookieStore.set(ACCESS_COOKIE, access, authCookieOptions(ACCESS_TOKEN_MAX_AGE, getHeader));

  return { user: toSessionUser(dbUser), dbUser };
}

export async function getSession(): Promise<{ user: SessionUser; dbUser: User } | null> {
  await connection();

  const cookieStore = await cookies();
  const access = cookieStore.get(ACCESS_COOKIE)?.value;
  if (access) {
    const session = await sessionFromAccess(access);
    if (session) return session;
  }

  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  return sessionFromRefresh(refresh);
}

export async function requireSession(): Promise<{ user: SessionUser; dbUser: User }> {
  const session = await getSession();
  if (!session) {
    throw new SessionError("UNAUTHORIZED", "Authentication required", 401);
  }
  return session;
}

export async function requireRole(...roles: string[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new SessionError("FORBIDDEN", "Insufficient permissions", 403);
  }
  return session;
}

export class SessionError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function attachAuthCookies(
  response: NextResponse,
  userId: string,
  email: string,
  role: string,
  name: string,
  refreshToken: string,
  refreshExpiresAt: Date,
  req?: Request
) {
  const access = await signAccessToken({ sub: userId, email, role, name });
  const getHeader = req ? (n: string) => req.headers.get(n) : await headerGetter();
  const refreshMaxAge = Math.max(0, Math.floor((refreshExpiresAt.getTime() - Date.now()) / 1000));

  response.cookies.set(ACCESS_COOKIE, access, authCookieOptions(ACCESS_TOKEN_MAX_AGE, getHeader));
  response.cookies.set(REFRESH_COOKIE, refreshToken, authCookieOptions(refreshMaxAge, getHeader));

  return response;
}

/** @deprecated Prefer attachAuthCookies(response, ...) in route handlers. */
export async function setAuthCookies(
  userId: string,
  email: string,
  role: string,
  name: string,
  refreshToken: string,
  refreshExpiresAt: Date,
  req?: Request
) {
  const cookieStore = await cookies();
  const access = await signAccessToken({ sub: userId, email, role, name });
  const getHeader = req ? (n: string) => req.headers.get(n) : await headerGetter();
  const refreshMaxAge = Math.max(0, Math.floor((refreshExpiresAt.getTime() - Date.now()) / 1000));

  cookieStore.set(ACCESS_COOKIE, access, authCookieOptions(ACCESS_TOKEN_MAX_AGE, getHeader));
  cookieStore.set(REFRESH_COOKIE, refreshToken, authCookieOptions(refreshMaxAge, getHeader));
}

export function clearAuthCookiesOnResponse(response: NextResponse) {
  response.cookies.delete({ name: ACCESS_COOKIE, path: "/" });
  response.cookies.delete({ name: REFRESH_COOKIE, path: "/" });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: ACCESS_COOKIE, path: "/" });
  cookieStore.delete({ name: REFRESH_COOKIE, path: "/" });
}

export async function readRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE)?.value;
}
