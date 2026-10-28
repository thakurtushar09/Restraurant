import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";

interface ReminderJob {
  orderId: string;
}

const worker = new Worker<ReminderJob>(
  "order-reminders",
  async (job) => {
    const order = await prisma.order.findUnique({
      where: { id: job.data.orderId },
      include: {
        branch: {
          select: {
            branchName: true,
          },
        },
      },
    });

    if (!order) return;

    if (
      ["CANCELLED", "REJECTED", "COMPLETED", "EXPIRED"].includes(
        order.orderStatus
      )
    ) {
      console.log(`Skipping reminder for order ${order.orderNumber}`);
      return;
    }

    if (order.orderStatus === "ACCEPTED") {
      console.log(
        `Preparation reminder: ${order.branch.branchName} — order ${order.orderNumber}`
      );
    } else if (order.orderStatus === "PENDING") {
      console.log(
        `Order ${order.orderNumber} is still awaiting restaurant acceptance.`
      );
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

worker.on("completed", (job) => {
  console.log(`Reminder job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Reminder job ${job?.id} failed:`, error.message);
});

worker.on("error", (error) => {
  console.error("Worker error:", error.message);
});

console.log("Order reminder worker started.");