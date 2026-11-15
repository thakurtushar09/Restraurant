
import { orderReminderQueue } from "../queues/order-reminder.queue";

export const MAX_SCHEDULE_DAYS = 7;

// How long an "as soon as possible" order may wait for the restaurant to confirm it.
export const ASAP_CONFIRM_MINUTES = 20;

// Scheduled orders must be in the future and within the booking window.
export function isValidScheduleTime(date: Date): boolean {
  const time = date.getTime();
  const maxTime = Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;

  return !Number.isNaN(time) && time > Date.now() && time <= maxTime;
}

// Remove a job that hasn't run yet. Finished or failed jobs are removed too,
// otherwise BullMQ would silently ignore a new job with the same ID.
async function removeJob(jobId: string): Promise<void> {
  const existingJob = await orderReminderQueue.getJob(jobId);
  if (!existingJob) return;

  const state = await existingJob.getState();

  if (state === "active") {
    throw new Error(`Cannot replace job ${jobId} while it is running`);
  }

  await existingJob.remove();
}

async function addJob(name: string, jobId: string, orderId: string, runAt: number): Promise<void> {
  await removeJob(jobId);

  await orderReminderQueue.add(
    name,
    { orderId },
    {
      jobId,
      delay: Math.max(0, runAt - Date.now()),
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
    }
  );
}

// The kitchen gets a heads-up this long before a scheduled order's start-cooking time.
export const PREP_HEADS_UP_MINUTES = 10;

// Start-cooking reminder, plus a heads-up shortly before it (skipped when that moment has passed).
export async function scheduleOrderReminder(orderId: string,scheduledAt: Date,preparationMinutes: number): Promise<void> {
  const reminderAt = scheduledAt.getTime() - preparationMinutes * 60 * 1000;
  await addJob("preparation-reminder", `order-reminder-${orderId}`, orderId, reminderAt);

  const headsUpAt = reminderAt - PREP_HEADS_UP_MINUTES * 60 * 1000;
  const headsUpId = `order-heads-up-${orderId}`;
  if (headsUpAt <= Date.now()) {
    await removeJob(headsUpId);
    return;
  }
  await addJob("prep-heads-up", headsUpId, orderId, headsUpAt);
}

export async function cancelOrderReminder(orderId: string):Promise<void> {
  for (const jobId of [`order-reminder-${orderId}`, `order-heads-up-${orderId}`]) {
    const job = await orderReminderQueue.getJob(jobId);
    if (!job) continue;
    const state = await job.getState();
    if (state === "waiting" || state === "delayed" || state === "prioritized") {
      await job.remove();
    }
  }
}

// A pending order expires once the kitchen could no longer have it ready on time:
// at the start-cooking time for scheduled orders, or after a short wait for ASAP ones.
export function orderExpiryTime(scheduledAt: Date | null, createdAt: Date, preparationMinutes: number): Date {
  return scheduledAt
    ? new Date(scheduledAt.getTime() - preparationMinutes * 60 * 1000)
    : new Date(createdAt.getTime() + ASAP_CONFIRM_MINUTES * 60 * 1000);
}

export async function scheduleOrderExpiry(orderId: string, expireAt: Date): Promise<void> {
  await addJob("expire-order", `order-expiry-${orderId}`, orderId, expireAt.getTime());
}

export async function cancelOrderExpiry(orderId: string): Promise<void> {
  const job = await orderReminderQueue.getJob(`order-expiry-${orderId}`);
  if (!job) return;
  const state = await job.getState();
  if (state === "waiting" || state === "delayed" || state === "prioritized") {
    await job.remove();
  }
}

// Pre-order guests get a reminder an hour before their table (skipped for short-notice bookings).
export const ARRIVAL_REMINDER_MINUTES = 60;

export async function scheduleArrivalReminder(orderId: string, scheduledAt: Date): Promise<void> {
  const remindAt = scheduledAt.getTime() - ARRIVAL_REMINDER_MINUTES * 60 * 1000;
  const jobId = `order-arrival-${orderId}`;
  if (remindAt <= Date.now()) {
    await removeJob(jobId);
    return;
  }
  await addJob("arrival-reminder", jobId, orderId, remindAt);
}
