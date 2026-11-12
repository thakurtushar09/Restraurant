import { renderLayout, paragraph, detailsTable, escapeHtml, type EmailContent } from "./layout";

export interface StaffInviteInput {
  name: string;
  email: string;
  password: string;
  groupName: string;
  // Null for group-wide roles such as admin.
  branchName: string | null;
  roleLabel: string;
  inviterName: string;
  loginUrl: string;
  verifyUrl: string;
}

// New teammate: an account was created for them, so they get their sign-in details.
export function staffInviteEmail(input: StaffInviteInput): EmailContent {
  const where = input.branchName ? `${input.groupName} · ${input.branchName}` : `${input.groupName} (all branches)`;

  return {
    subject: `You've been added to ${input.groupName}`,
    html: renderLayout({
      preheader: `${input.inviterName} added you as ${input.roleLabel}. Your sign-in details are inside.`,
      eyebrow: "Welcome to the team",
      heading: `Join ${input.groupName}`,
      blocks: [
        paragraph(`Hi ${escapeHtml(input.name)},`),
        paragraph(`${escapeHtml(input.inviterName)} added you to the restaurant dashboard as <strong>${escapeHtml(input.roleLabel)}</strong> at <strong>${escapeHtml(where)}</strong>.`),
        paragraph("Use these details to sign in. You'll be asked to choose your own password straight away."),
        detailsTable([
          ["Sign in at", `<a href="${escapeHtml(input.loginUrl)}" style="color:#2a8158;">${escapeHtml(input.loginUrl)}</a>`],
          ["Email", escapeHtml(input.email)],
          ["Temporary password", escapeHtml(input.password)],
        ], { monospace: true }),
        paragraph("First, confirm this email address belongs to you:"),
      ],
      button: { label: "Confirm email", url: input.verifyUrl },
      footnote: "Keep this password private and change it after your first sign-in. If you weren't expecting this, you can ignore this email.",
    }),
    text: [
      `Hi ${input.name},`,
      "",
      `${input.inviterName} added you to the restaurant dashboard as ${input.roleLabel} at ${where}.`,
      "",
      `Sign in at: ${input.loginUrl}`,
      `Email: ${input.email}`,
      `Temporary password: ${input.password}`,
      "",
      "You'll be asked to choose your own password after signing in.",
      `Confirm your email: ${input.verifyUrl}`,
    ].join("\n"),
  };
}
