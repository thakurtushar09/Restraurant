import { Resend } from "resend";
import type { EmailContent } from "../emails";

let client: Resend | null | undefined;

function getClient(): Resend | null {
  if (client === undefined) {
    const apiKey = process.env.RESEND_API_KEY;
    client = apiKey ? new Resend(apiKey) : null;
    if (!client) console.warn("RESEND_API_KEY missing: emails are disabled.");
  }
  return client;
}

export type SendEmailResult = { sent: true; id: string } | { sent: false; error: string };

// Sends one email. Never throws: a failed email must not break the request that triggered it.
export async function sendEmail(to: string, content: EmailContent): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) return { sent: false, error: "Email is not configured on the server" };

  try {
    const { data, error } = await resend.emails.send({
      // Any address on the verified craveq.in domain works; EMAIL_FROM overrides it.
      from: process.env.EMAIL_FROM || "CraveQ <noreply@craveq.in>",
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    if (error || !data) {
      console.error(`Email to ${to} failed:`, error?.message);
      // Resend test mode (no verified domain) only delivers to the account owner's address.
      const testMode = /testing email|verify a domain|own email address/i.test(error?.message ?? "");
      return { sent: false, error: testMode ? "email is in test mode until a sending domain is verified" : error?.message ?? "Unknown email error" };
    }

    return { sent: true, id: data.id };
  } catch (error) {
    console.error(`Email to ${to} failed:`, error);
    return { sent: false, error: (error as Error).message };
  }
}

export type AppName = "customer" | "dashboard";

export function appUrl(app: AppName, path = ""): string {
  const base = app === "dashboard"
    ? process.env.DASHBOARD_APP_URL || "http://localhost:5174"
    : process.env.CUSTOMER_APP_URL || "http://localhost:5173";
  return `${base.replace(/\/+$/, "")}${path}`;
}
