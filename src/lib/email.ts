import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    await resend.emails.send({
      from: "NeuroLearn <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    return true;
  } catch (err) {
    console.error("Resend Error:", err);
    return false;
  }
}

export function buildResetEmail(resetUrl: string, name?: string) {
  return `
  <div style="font-family:Arial,sans-serif;padding:40px;background:#f6f6f6">
    <div style="max-width:600px;margin:auto;background:white;padding:40px;border-radius:16px">
      <h2>Reset your NeuroLearn password</h2>

      <p>Hi ${name ?? "there"},</p>

      <p>You requested a password reset.</p>

      <p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 24px;background:#6C63FF;color:white;text-decoration:none;border-radius:10px;">
          Reset Password
        </a>
      </p>

      <p>This link expires in one hour.</p>

      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
  `;
}