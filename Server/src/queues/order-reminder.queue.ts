import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const orderReminderQueue = new Queue("order-reminders", {
  connection: redisConnection,
});