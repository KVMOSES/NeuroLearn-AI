/**
 * GET /api/health — liveness + readiness check with dependency status.
 */
import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export async function GET() {
  const checks: Record<string, "ok" | "fail"> = { api: "ok" };
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  return ok(
    {
      status: healthy ? "healthy" : "degraded",
      service: "neurolearn-ai",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      checks,
    },
    undefined,
    healthy ? 200 : 503
  );
}
