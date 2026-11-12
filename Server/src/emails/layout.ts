// Shared look for every email: table layout + inline styles so it renders in Gmail, Outlook and Apple Mail.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface LayoutOptions {
  preheader: string;
  eyebrow?: string;
  heading: string;
  // Already-escaped HTML blocks rendered in order under the heading.
  blocks: string[];
  button?: { label: string; url: string };
  footnote?: string;
}

const COLORS = {
  forest: "#1f362d",
  ink: "#26372e",
  muted: "#6f7a70",
  line: "#e3e8df",
  bg: "#f3f5f0",
  paper: "#fffdf8",
  mist: "#eef2ec",
  green: "#2a8158",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${COLORS.ink};">${html}</p>`;
}

// Label/value rows in a soft panel, e.g. login details or an order summary.
export function detailsTable(rows: [label: string, value: string][], { monospace = false } = {}): string {
  const cells = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:${COLORS.muted};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:10px 16px;font-size:15px;color:${COLORS.ink};font-weight:600;word-break:break-all;${monospace ? "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" : ""}">${value}</td>
      </tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.mist};border-radius:10px;margin:0 0 20px;">${cells}</table>`;
}

export function renderLayout({ preheader, eyebrow, heading, blocks, button, footnote }: LayoutOptions): string {
  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:10px;background:${COLORS.forest};">
        <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(button.label)}</a>
      </td></tr></table>
      <p style="margin:0 0 16px;font-size:12px;line-height:18px;color:${COLORS.muted};">Button not working? Paste this link into your browser:<br><a href="${escapeHtml(button.url)}" style="color:${COLORS.green};word-break:break-all;">${escapeHtml(button.url)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:${FONT};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.paper};border:1px solid ${COLORS.line};border-radius:16px;">
        <tr><td style="height:6px;background:${COLORS.forest};border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px;">
          ${eyebrow ? `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:${COLORS.green};">${escapeHtml(eyebrow)}</p>` : ""}
          <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;font-weight:600;color:${COLORS.forest};">${escapeHtml(heading)}</h1>
          ${blocks.join("\n")}
          ${buttonHtml}
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid ${COLORS.line};">
          <p style="margin:0;font-size:12px;line-height:18px;color:${COLORS.muted};">${footnote ? `${escapeHtml(footnote)}<br>` : ""}This is an automated message — replies aren't monitored.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
