import { orderReminderQueue } from "../queues/order-reminder.queue";

export async function scheduleOrderReminder(
  orderId: string,
  scheduledAt: Date,
  preparationMinutes: number
) {
  const reminderAt =
    scheduledAt.getTime() - preparationMinutes * 60 * 1000;

  const delay = reminderAt - Date.now();

  if (delay <= 0) {
    console.log(`Reminder time has already passed for order ${orderId}`);
    return;
  }

  await orderReminderQueue.add(
    "preparation-reminder",
    { orderId },
    {
      jobId: `order-reminder-${orderId}`,
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