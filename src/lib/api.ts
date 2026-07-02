/**
 * Standard API response helpers & error types.
 */
import { NextResponse } from "next/server";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data, meta }, { status });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: { code, message, details } },
    { status }
  );
}

export const ApiError = {
  Unauthorized: (msg = "Unauthorized") => fail("UNAUTHORIZED", msg, 401),
  Forbidden: (msg = "Forbidden") => fail("FORBIDDEN", msg, 403),
  NotFound: (msg = "Resource not found") => fail("NOT_FOUND", msg, 404),
  Conflict: (msg = "Resource already exists") => fail("CONFLICT", msg, 409),
  Validation: (msg: string, details?: unknown) => fail("VALIDATION_ERROR", msg, 422, details),
  RateLimited: (msg = "Too many requests") => fail("RATE_LIMITED", msg, 429),
  Internal: (msg = "Internal server error") => fail("INTERNAL_ERROR", msg, 500),
};
