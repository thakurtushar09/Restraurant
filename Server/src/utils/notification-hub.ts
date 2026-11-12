import type { Response } from "express";
import type IORedis from "ioredis";
import { redisConnection } from "../config/redis";

// Notifications are published on Redis so events raised in the worker process
// reach browsers connected to the API process.
export const NOTIFICATION_CHANNEL = "notifications";

export type NotificationAudience = "CUSTOMER" | "STAFF";

export interface NotificationEvent {
  userId: string;
  audience: NotificationAudience;
  notification: unknown;
}

type Client = { res: Response; audience: NotificationAudience };

const clients = new Map<string, Set<Client>>();
let subscriber: IORedis | null = null;

function deliver(event: NotificationEvent): void {
  for (const client of clients.get(event.userId) ?? []) {
    if (client.audience === event.audience) {
      client.res.write(`event: notification\ndata: ${JSON.stringify(event.notification)}\n\n`);
    }
  }
}

// Subscribe lazily: only the API process opens streams, so only it needs a subscriber.
function ensureSubscriber(): void {
  if (subscriber) return;

  subscriber = redisConnection.duplicate();
  subscriber.subscribe(NOTIFICATION_CHANNEL).catch((error: Error) => {
    console.error("Notification subscribe failed:", error.message);
  });
  subscriber.on("message", (_channel, raw) => {
    try {
      (JSON.parse(raw) as NotificationEvent[]).forEach(deliver);
    } catch (error) {
      console.error("Bad notification message:", error);
    }
  });
}

// Registers an open SSE response; returns a function that unregisters it.
export function addClient(userId: string, audience: NotificationAudience, res: Response): () => void {
  ensureSubscriber();

  const client: Client = { res, audience };
  const set = clients.get(userId) ?? new Set<Client>();
  set.add(client);
  clients.set(userId, set);

  return () => {
    set.delete(client);
    if (set.size === 0) clients.delete(userId);
  };
}

export async function publishNotifications(events: NotificationEvent[]): Promise<void> {
  if (events.length) {
    await redisConnection.publish(NOTIFICATION_CHANNEL, JSON.stringify(events));
  }
}
