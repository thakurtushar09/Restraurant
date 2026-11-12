import { renderLayout, paragraph, escapeHtml, type EmailContent } from "./layout";

export interface VerifyEmailInput {
  name: string;
  verifyUrl: string;
  audience: "customer" | "staff";
}

// Sent after signup (customers and restaurant owners) and whenever someone asks for a new link.
export function verifyEmail({ name, verifyUrl, audience }: VerifyEmailInput): EmailContent {
  const why = audience === "customer"
    ? "We'll send your order confirmations and table updates to this address."
    : "We'll use this address for your restaurant's account, team invites and security alerts.";

  return {
    subject: "Confirm your email address",
    html: renderLayout({
      preheader: "One tap to confirm your email. The link works for 3 days.",
      eyebrow: "Almost there",
      heading: "Confirm your email",
      blocks: [
        paragraph(`Hi ${escapeHtml(name)},`),
        paragraph(`Please confirm this is your email address. ${why}`),
      ],
      button: { label: "Confirm email", url: verifyUrl },
      footnote: "The link expires in 3 days. If you didn't create an account, you can ignore this email.",
    }),
    text: `Hi ${name},\n\nPlease confirm your email address. ${why}\n\nConfirm: ${verifyUrl}\n\nThe link expires in 3 days. If you didn't create an account, ignore this email.`,
  };
}
