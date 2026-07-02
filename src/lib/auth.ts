/**
 * Authentication & security utilities.
 * Uses Web Crypto (via Node crypto) for password hashing & JWT (jose) for tokens.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || "neurolearn-access-secret-dev-change-me"
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || "neurolearn-refresh-secret-dev-change-me"
);

export const ACCESS_TOKEN_TTL = "15m"; // 15 minutes
export const ACCESS_TOKEN_MAX_AGE = 60 * 15;
export const REFRESH_TOKEN_TTL_DAYS = 30;

// ============================================================
// PASSWORD HASHING (scrypt)
// ============================================================

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

/**
 * Password strength validation. Returns score 0..4 and reasons.
 */
export function validatePasswordStrength(password: string): {
  score: number;
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (password.length < 8) reasons.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) reasons.push("An uppercase letter");
  if (!/[a-z]/.test(password)) reasons.push("A lowercase letter");
  if (!/[0-9]/.test(password)) reasons.push("A number");
  if (!/[^A-Za-z0-9]/.test(password)) reasons.push("A special character");

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(score, 4);

  return { score, ok: reasons.length === 0, reasons };
}

// ============================================================
// JWT
// ============================================================

export interface AccessPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  type: "access";
}

export async function signAccessToken(payload: Omit<AccessPayload, "type">): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(ACCESS_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return payload as unknown as AccessPayload;
  } catch {
    return null;
  }
}

export async function signRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return { token, expiresAt };
}

// ============================================================
// COOKIE HELPERS
// ============================================================

export const ACCESS_COOKIE = "nl_access";
export const REFRESH_COOKIE = "nl_refresh";

type HeaderGetter = (name: string) => string | null;

/** Whether auth cookies should include the Secure flag. */
export function resolveCookieSecure(headerGet?: HeaderGetter): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;

  const forwarded = headerGet?.("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  }

  // Never default to Secure without a TLS signal — production deployments
  // behind HTTP reverse proxies (e.g. Caddy on :81) would reject cookies.
  return false;
}

export function authCookieOptions(maxAgeSeconds: number, headerGet?: HeaderGetter) {
  return {
    httpOnly: true,
    secure: resolveCookieSecure(headerGet),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** @deprecated Use authCookieOptions() — kept for callers passing Request headers. */
export function cookieOptions(maxAgeSeconds: number, headerGet?: HeaderGetter) {
  return authCookieOptions(maxAgeSeconds, headerGet);
}

// ============================================================
// DEVICE FINGERPRINT / ACCOUNT LOCKOUT
// ============================================================

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export function isAccountLocked(lockedUntil: Date | null): boolean {
  return !!lockedUntil && lockedUntil.getTime() > Date.now();
}

export function lockoutExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + LOCKOUT_MINUTES);
  return d;
}
