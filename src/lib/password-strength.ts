/**
 * Client-side password strength validator (mirrors server logic).
 */
export function validatePasswordStrengthClient(password: string): {
  score: number;
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (password.length < 8) reasons.push("8+ characters");
  if (!/[A-Z]/.test(password)) reasons.push("uppercase letter");
  if (!/[a-z]/.test(password)) reasons.push("lowercase letter");
  if (!/[0-9]/.test(password)) reasons.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) reasons.push("a special character");

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(score, 4);

  return { score, ok: reasons.length === 0, reasons };
}
