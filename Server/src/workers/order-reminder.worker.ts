import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { notifyOrderEvent } from "../utils/notify";
import { cancelOrderExpiry } from "../utils/schedule-order-reminder";

interface ReminderJob {
  orderId: string;
}

const FINISHED = ["CANCELLED", "REJECTED", "COMPLETED", "EXPIRED"];

// Auto-accept branches: a scheduled order still waiting (or just accepted) goes straight to cooking.
// Conditional on status, so whichever job gets there first wins and the kitchen's own moves are respected.
async function autoStartCooking(orderId: string): Promise<boolean> {
  const now = new Date();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { acceptedAt: true } });
  const started = await prisma.order.updateMany({
    where: {
      id: orderId,
      orderStatus: { in: ["PENDING", "ACCEPTED"] },
      scheduledAt: { not: null },
      branch: { autoAcceptPreorders: true },
    },
    data: { orderStatus: "PREPARING", acceptedAt: order?.acceptedAt ?? now, preparingAt: now },
  });
  if (started.count === 0) return false;
  await cancelOrderExpiry(orderId).catch(() => {});
  await notifyOrderEvent(orderId, "AUTO_STARTED");
  return true;
}

const worker = new Worker<ReminderJob>(
  "order-reminders",
  async (job) => {
    const { orderId } = job.data;

    // Unconfirmed orders expire; the conditional update leaves orders the restaurant already handled alone.
    if (job.name === "expire-order") {
      // A scheduled order's expiry is its start-cooking time: on auto-accept branches it starts instead.
      if (await autoStartCooking(orderId)) return;
      const expired = await prisma.order.updateMany({
        where: { id: orderId, orderStatus: "PENDING" },
        data: {
          orderStatus: "EXPIRED",
          cancellationReason: "The restaurant didn't confirm in time",
        },
      });

      if (expired.count > 0) {
        console.log(`Order ${orderId} expired without confirmation.`);
        await notifyOrderEvent(orderId, "EXPIRED");
      }
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, orderStatus: true },
    });

    if (!order || FINISHED.includes(order.orderStatus)) return;

    // Kitchen: a scheduled order's start-cooking time is coming up.
    if (job.name === "prep-heads-up") {
      if (["PENDING", "ACCEPTED"].includes(order.orderStatus)) {
        await notifyOrderEvent(orderId, "PREP_SOON");
      }
      return;
    }

    // Kitchen: time to start cooking a scheduled order (or a warning if nobody accepted it).
    if (job.name === "preparation-reminder") {
      if (await autoStartCooking(orderId)) return;
      if (["PENDING", "ACCEPTED"].includes(order.orderStatus)) {
        await notifyOrderEvent(orderId, "COOK_NOW");
      }
      return;
    }

    // Guest: reminder an hour before a confirmed pre-order.
    if (job.name === "arrival-reminder" && order.orderStatus !== "PENDING") {
      await notifyOrderEvent(orderId, "ARRIVAL_REMINDER");
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

worker.on("completed", (job) => {
  console.log(`Order job completed: ${job.name} ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Order job ${job?.id} failed:`, error.message);
});

worker.on("error", (error) => {
  console.error("Worker error:", error.message);
});

console.log("Order worker started.");
