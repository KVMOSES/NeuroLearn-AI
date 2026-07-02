import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "NeuroLearn AI",
    version: "1.0.0",
    status: "online",
    docs: "/api/health",
  });
}
