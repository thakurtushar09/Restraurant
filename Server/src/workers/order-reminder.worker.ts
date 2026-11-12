import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { notifyOrderEvent } from "../utils/notify";

interface ReminderJob {
  orderId: string;
}

const FINISHED = ["CANCELLED", "REJECTED", "COMPLETED", "EXPIRED"];

const worker = new Worker<ReminderJob>(
  "order-reminders",
  async (job) => {
    const { orderId } = job.data;

    // Unconfirmed orders expire; the conditional update leaves orders the restaurant already handled alone.
    if (job.name === "expire-order") {
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

    // Kitchen: time to start cooking a scheduled order (or a warning if nobody accepted it).
    if (job.name === "preparation-reminder") {
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
