import { renderLayout, paragraph, escapeHtml, type EmailContent } from "./layout";

export interface StaffAddedInput {
  name: string;
  groupName: string;
  branchName: string | null;
  roleLabel: string;
  inviterName: string;
  loginUrl: string;
}

// Existing account added to a restaurant: no new password, they sign in as usual.
export function staffAddedEmail(input: StaffAddedInput): EmailContent {
  const where = input.branchName ? `${input.groupName} · ${input.branchName}` : `${input.groupName} (all branches)`;

  return {
    subject: `You now have access to ${input.groupName}`,
    html: renderLayout({
      preheader: `${input.inviterName} added you as ${input.roleLabel}.`,
      eyebrow: "New access",
      heading: `You're on the ${input.groupName} team`,
      blocks: [
        paragraph(`Hi ${escapeHtml(input.name)},`),
        paragraph(`${escapeHtml(input.inviterName)} gave your account <strong>${escapeHtml(input.roleLabel)}</strong> access at <strong>${escapeHtml(where)}</strong>.`),
        paragraph("Sign in with your existing email and password — the restaurant will appear in your dashboard."),
      ],
      button: { label: "Open dashboard", url: input.loginUrl },
      footnote: "If you don't recognise this restaurant, let them know or ignore this email.",
    }),
    text: `Hi ${input.name},\n\n${input.inviterName} gave your account ${input.roleLabel} access at ${where}.\nSign in with your existing email and password: ${input.loginUrl}`,
  };
}
