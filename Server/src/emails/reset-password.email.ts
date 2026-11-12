import { renderLayout, paragraph, escapeHtml, type EmailContent } from "./layout";

export interface ResetPasswordInput {
  name: string;
  resetUrl: string;
}

// "Forgot password" link, for customers and restaurant teams alike.
export function resetPasswordEmail({ name, resetUrl }: ResetPasswordInput): EmailContent {
  return {
    subject: "Reset your password",
    html: renderLayout({
      preheader: "Use this link within an hour to choose a new password.",
      eyebrow: "Security",
      heading: "Reset your password",
      blocks: [
        paragraph(`Hi ${escapeHtml(name)},`),
        paragraph("Someone asked to reset the password for your account. If it was you, choose a new one below. You'll be signed out on every other device."),
      ],
      button: { label: "Choose a new password", url: resetUrl },
      footnote: "The link works once and expires in 1 hour. If you didn't ask for this, ignore this email — your password stays the same.",
    }),
    text: `Hi ${name},\n\nSomeone asked to reset your password. If it was you, choose a new one here:\n${resetUrl}\n\nThe link works once and expires in 1 hour. If you didn't ask for this, ignore this email.`,
  };
}
