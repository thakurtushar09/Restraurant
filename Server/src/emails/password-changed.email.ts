import { renderLayout, paragraph, escapeHtml, type EmailContent } from "./layout";

export interface PasswordChangedInput {
  name: string;
  changedAt: Date;
}

// Security notice for any account whose password changes.
export function passwordChangedEmail({ name, changedAt }: PasswordChangedInput): EmailContent {
  const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(changedAt);

  return {
    subject: "Your password was changed",
    html: renderLayout({
      preheader: `Your password was changed on ${when}.`,
      eyebrow: "Security",
      heading: "Password changed",
      blocks: [
        paragraph(`Hi ${escapeHtml(name)},`),
        paragraph(`The password for your account was changed on <strong>${escapeHtml(when)} IST</strong>.`),
        paragraph("If this was you, there's nothing else to do. If it wasn't, contact your restaurant owner or support right away."),
      ],
    }),
    text: `Hi ${name},\n\nThe password for your account was changed on ${when} IST.\nIf this wasn't you, contact your restaurant owner or support right away.`,
  };
}
