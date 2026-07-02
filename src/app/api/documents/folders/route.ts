/**
 * GET   /api/documents/folders — list folders
 * POST  /api/documents/folders — create folder
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const folders = await db.folder.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { documents: true } } },
    orderBy: { name: "asc" },
  });

  return ok({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      parentId: f.parentId,
      documentCount: f._count.documents,
      createdAt: f.createdAt,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().optional().default("violet"),
  parentId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const folder = await db.folder.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      color: parsed.data.color,
      parentId: parsed.data.parentId ?? null,
    },
  });
  return ok({ folder }, undefined, 201);
}
