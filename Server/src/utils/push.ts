import webpush from "web-push";
import { prisma } from "../config/prisma";
import type { NotificationAudience } from "./notification-hub";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// Push is optional: without keys the app still works with in-app notifications.
export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
} else {
  console.warn("VAPID keys missing: phone push notifications are disabled.");
}

export const vapidPublicKey = publicKey ?? null;

export interface PushNotificationRow {
  id: string;
  userId: string;
  audience: NotificationAudience;
  title: string;
  body: string;
  orderId: string | null;
}

// Where tapping the notification should land in each app.
function urlFor(row: PushNotificationRow): string {
  if (row.audience === "STAFF") return "/orders";
  return row.orderId ? `/orders/${row.orderId}` : "/orders";
}

// Sends each notification to every device its recipient has registered for that app.
export async function sendPush(rows: PushNotificationRow[]): Promise<void> {
  if (!pushEnabled || rows.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { OR: rows.map((row) => ({ userId: row.userId, audience: row.audience })) },
  });
  if (subscriptions.length === 0) return;

  const expired: string[] = [];

  await Promise.all(rows.flatMap((row) =>
    subscriptions
      .filter((sub) => sub.userId === row.userId && sub.audience === row.audience)
      .map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: row.title, body: row.body, tag: row.id, url: urlFor(row) }),
            { TTL: 60 * 60, urgency: "high" }
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410: the browser unsubscribed or the subscription expired.
          if (status === 404 || status === 410) expired.push(sub.id);
          else console.error("Push send failed:", status ?? (error as Error).message);
        }
      })
  ));

  if (expired.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
  }
}
