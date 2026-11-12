import { renderLayout, paragraph, detailsTable, escapeHtml, type EmailContent } from "./layout";

export interface OrderUpdateInput {
  customerName: string;
  // Same title/body the in-app and push notification use, so every channel says the same thing.
  title: string;
  body: string;
  orderNumber: string;
  placeName: string;
  when: string | null;
  whenLabel: string;
  items: { quantity: number; name: string; lineTotal: string }[];
  total: string;
  orderUrl: string;
}

// Customer emails for the order moments worth keeping in an inbox (confirmed, declined, cancelled, expired).
export function orderUpdateEmail(input: OrderUpdateInput): EmailContent {
  const rows: [string, string][] = [
    ["Order", escapeHtml(`#${input.orderNumber}`)],
    ["Restaurant", escapeHtml(input.placeName)],
    ...(input.when ? [[input.whenLabel, escapeHtml(input.when)] as [string, string]] : []),
  ];
  const items = input.items
    .map((item) => `<tr>
      <td style="padding:6px 0;font-size:14px;color:#26372e;">${item.quantity}× ${escapeHtml(item.name)}</td>
      <td style="padding:6px 0;font-size:14px;color:#26372e;text-align:right;white-space:nowrap;">${escapeHtml(item.lineTotal)}</td>
    </tr>`)
    .join("");

  return {
    subject: `${input.title} · #${input.orderNumber}`,
    html: renderLayout({
      preheader: input.body,
      eyebrow: input.placeName,
      heading: input.title,
      blocks: [
        paragraph(`Hi ${escapeHtml(input.customerName)},`),
        paragraph(escapeHtml(input.body)),
        detailsTable(rows),
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px dashed #cfd8cb;border-bottom:1px dashed #cfd8cb;">
          ${items}
          <tr><td style="padding:10px 0;font-size:15px;font-weight:700;color:#1f362d;">Total</td><td style="padding:10px 0;font-size:15px;font-weight:700;color:#1f362d;text-align:right;">${escapeHtml(input.total)}</td></tr>
        </table>`,
      ],
      button: { label: "View order", url: input.orderUrl },
      footnote: "You're getting this because you placed an order with this email address.",
    }),
    text: [
      `Hi ${input.customerName},`,
      "",
      input.body,
      "",
      `Order #${input.orderNumber} · ${input.placeName}`,
      ...(input.when ? [`${input.whenLabel}: ${input.when}`] : []),
      ...input.items.map((item) => `${item.quantity}× ${item.name}  ${item.lineTotal}`),
      `Total: ${input.total}`,
      "",
      `View order: ${input.orderUrl}`,
    ].join("\n"),
  };
}
