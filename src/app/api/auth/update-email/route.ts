/**
 * POST /api/auth/update-email
 * Update the user's email address with validation and duplicate checking.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  currentPassword: z.string().min(1, "Current password is required for security"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return ApiError.Validation("Validation failed", parsed.error.flatten());
  }

  const { email, currentPassword } = parsed.data;
  const userId = session.user.id;

  try {
    // Verify current password
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return ApiError.NotFound("User not found");

    const { verifyPassword } = await import("@/lib/auth");
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return ApiError.Validation("Current password is incorrect");
    }

    // Check if new email is already taken by another user
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return ApiError.Conflict("This email is already associated with another account");
    }

    // If same email, no change needed
    if (user.email === email) {
      return ok({ message: "Email unchanged", email: user.email });
    }

    // Update the email
    await db.user.update({
      where: { id: userId },
      data: {
        email,
        emailVerified: false, // Reset verification status for new email
      },
    });

    return ok({ message: "Email updated successfully", email });
  } catch (err) {
    console.error("[UPDATE-EMAIL] Error:", err);
    return ApiError.Internal("Failed to update email. Please try again.");
  }
}