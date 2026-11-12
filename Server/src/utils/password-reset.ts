import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { resetPasswordEmail } from "../emails";
import { sendEmail, appUrl, type AppName, type SendEmailResult } from "./send-email";

const PURPOSE = "reset-password";
const TOKEN_TTL = "1h";

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not configured");
  return value;
}

// Changes whenever the password does, so a link stops working once it has been used.
function fingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export function createResetToken(userId: string, passwordHash: string): string {
  return jwt.sign({ sub: userId, fp: fingerprint(passwordHash), purpose: PURPOSE }, secret(), { expiresIn: TOKEN_TTL });
}

export function readResetToken(token: string): { userId: string; fp: string } | null {
  try {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded === "string" || decoded.purpose !== PURPOSE || typeof decoded.sub !== "string" || typeof decoded.fp !== "string") {
      return null;
    }
    return { userId: decoded.sub, fp: decoded.fp };
  } catch {
    return null;
  }
}

export function resetTokenMatches(fp: string, passwordHash: string): boolean {
  return fp === fingerprint(passwordHash);
}

export async function sendPasswordResetEmail(user: { id: string; fullName: string; email: string; passwordHash: string }, app: AppName): Promise<SendEmailResult> {
  const token = createResetToken(user.id, user.passwordHash);
  return sendEmail(user.email, resetPasswordEmail({
    name: user.fullName,
    resetUrl: appUrl(app, `/reset-password?token=${encodeURIComponent(token)}`),
  }));
}
