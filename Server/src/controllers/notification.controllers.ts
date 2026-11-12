import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { addClient, type NotificationAudience } from "../utils/notification-hub";
import { pushEnabled, vapidPublicKey } from "../utils/push";

const HEARTBEAT_MS = 25000;

function readAudience(req: Request): NotificationAudience | null {
  const audience = typeof req.query.audience === "string" ? req.query.audience.toUpperCase() : "CUSTOMER";
  return audience === "CUSTOMER" || audience === "STAFF" ? audience : null;
}

function badAudience(res: Response): void {
  res.status(400).json({
    success: false,
    message: "Audience must be CUSTOMER or STAFF",
  });
}

// Server-Sent Events stream: pushes each new notification as it is created.
export const streamNotifications = (req: Request, res: Response): void => {
  const userId = res.locals.userId as string;
  const audience = readAudience(req);

  if (!audience) {
    badAudience(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 5000\n\n");

  const remove = addClient(userId, audience, res);
  // Comments keep proxies from closing an idle connection.
  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    remove();
  });
};

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const audience = readAudience(req);

    if (!audience) {
      badAudience(res);
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, audience },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId, audience, readAt: null } }),
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      unread,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

export const markNotificationRead = async (req: Request<{ notificationId: string }>, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;

    const result = await prisma.notification.updateMany({
      where: { id: req.params.notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });

    res.status(200).json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const audience = readAudience(req);

    if (!audience) {
      badAudience(res);
      return;
    }

    const result = await prisma.notification.updateMany({
      where: { userId, audience, readAt: null },
      data: { readAt: new Date() },
    });

    res.status(200).json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notifications",
    });
  }
};

// ---------- web push ----------

export const getPushPublicKey = (_req: Request, res: Response): void => {
  if (!pushEnabled || !vapidPublicKey) {
    res.status(503).json({
      success: false,
      message: "Push notifications are not configured on the server",
    });
    return;
  }

  res.status(200).json({
    success: true,
    publicKey: vapidPublicKey,
  });
};

interface SubscribeBody {
  audience?: string;
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
}

export const subscribePush = async (req: Request<{}, {}, SubscribeBody>, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const audience = req.body?.audience === "STAFF" ? "STAFF" : req.body?.audience === "CUSTOMER" ? "CUSTOMER" : null;
    const subscription = req.body?.subscription;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!audience) {
      badAudience(res);
      return;
    }

    if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || typeof p256dh !== "string" || typeof auth !== "string") {
      res.status(400).json({
        success: false,
        message: "A valid push subscription is required",
      });
      return;
    }

    // The endpoint identifies the device; re-subscribing moves it to whoever is signed in now.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, audience, endpoint, p256dh, auth, userAgent: req.get("user-agent")?.slice(0, 300) ?? null },
      update: { userId, audience, p256dh, auth },
    });

    res.status(201).json({
      success: true,
      message: "Push notifications turned on for this device",
    });
  } catch (error) {
    console.error("Push subscribe error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to turn on push notifications",
    });
  }
};

export const unsubscribePush = async (req: Request<{}, {}, { endpoint?: unknown }>, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const endpoint = req.body?.endpoint;

    if (typeof endpoint !== "string") {
      res.status(400).json({
        success: false,
        message: "Endpoint is required",
      });
      return;
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });

    res.status(200).json({
      success: true,
      message: "Push notifications turned off for this device",
    });
  } catch (error) {
    console.error("Push unsubscribe error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to turn off push notifications",
    });
  }
};
