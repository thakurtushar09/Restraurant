
import { orderReminderQueue } from "../queues/order-reminder.queue";

export async function scheduleOrderReminder(orderId: string,scheduledAt: Date,preparationMinutes: number): Promise<void> {
  const jobId = `order-reminder-${orderId}`;

  // Remove the previous reminder if it is still waiting.
  const existingJob = await orderReminderQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    if (state === "waiting" || state === "delayed" || state === "prioritized") {
      await existingJob.remove();
    } else if (state === "active") {
      throw new Error("Cannot reschedule while the reminder job is active");
    }
  }

  const reminderAt =scheduledAt.getTime() - preparationMinutes * 60 * 1000;

  const delay = Math.max(0, reminderAt - Date.now());
  await orderReminderQueue.add(
    "preparation-reminder",
    { orderId },
    {
      jobId,
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
    }
  );
}

export async function cancelOrderReminder(orderId: string):Promise<void> {
  const jobId = `order-reminder-${orderId}`;
  const job = await orderReminderQueue.getJob(jobId);
  if (!job) return;
  const state = await job.getState();
  if (state === "waiting" || state === "delayed" || state === "prioritized") {
    await job.remove();
  }
}
