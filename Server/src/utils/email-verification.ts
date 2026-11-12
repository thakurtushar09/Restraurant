import jwt from "jsonwebtoken";
import { verifyEmail } from "../emails";
import { sendEmail, appUrl, type AppName, type SendEmailResult } from "./send-email";

const PURPOSE = "verify-email";
const TOKEN_TTL = "3d";

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not configured");
  return value;
}

// Signed, expiring token tied to the address, so changing the email invalidates old links.
export function createVerificationToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, purpose: PURPOSE }, secret(), { expiresIn: TOKEN_TTL });
}

export function readVerificationToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded === "string" || decoded.purpose !== PURPOSE || typeof decoded.sub !== "string" || typeof decoded.email !== "string") {
      return null;
    }
    return { userId: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

export function verificationUrl(app: AppName, userId: string, email: string): string {
  return appUrl(app, `/verify-email?token=${encodeURIComponent(createVerificationToken(userId, email))}`);
}

export async function sendVerificationEmail(user: { id: string; fullName: string; email: string }, app: AppName): Promise<SendEmailResult> {
  return sendEmail(user.email, verifyEmail({
    name: user.fullName,
    verifyUrl: verificationUrl(app, user.id, user.email),
    audience: app === "dashboard" ? "staff" : "customer",
  }));
}
