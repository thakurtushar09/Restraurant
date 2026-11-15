
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { RescheduleOrderRequestBody } from "../types/order.types";
import {scheduleOrderReminder,scheduleOrderExpiry,scheduleArrivalReminder,orderExpiryTime,isValidScheduleTime,MAX_SCHEDULE_DAYS,} from "../utils/schedule-order-reminder";
import { notifyOrderEvent } from "../utils/notify";
import { isOpenAt } from "../utils/opening-hours";

const RESCHEDULABLE = ["PENDING", "ACCEPTED"] as const;

export const rescheduleOrder = async (
  req: Request<{ orderId: string }, {}, RescheduleOrderRequestBody>,
  res: Response
): Promise<void> => {
  try {
    const userId = res.locals.userId as string | undefined;
    const { orderId } = req.params;
    const { scheduledAt } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Please log in first",
      });
      return;
    }

    const newScheduledAt = new Date(scheduledAt);

    if (!scheduledAt || !isValidScheduleTime(newScheduledAt)) {
      res.status(400).json({
        success: false,
        message: `Scheduled time must be a valid date within the next ${MAX_SCHEDULE_DAYS} days`,
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        // Guests can move their time until the kitchen starts cooking.
        orderStatus: { in: [...RESCHEDULABLE] },
        scheduledAt: { not: null },
      },
      include: {
        branch: {
          select: {
            averagePreparationTimeMinutes: true,
            openingHours: true,
            timezone: true,
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Scheduled order not found or cannot be rescheduled",
      });
      return;
    }

    if (newScheduledAt.getTime() < Date.now() + order.branch.averagePreparationTimeMinutes * 60 * 1000) {
      res.status(400).json({
        success: false,
        message: "That time is too soon for the kitchen. Please choose a later time.",
      });
      return;
    }

    if (!isOpenAt(order.branch.openingHours, order.branch.timezone, newScheduledAt)) {
      res.status(400).json({
        success: false,
        message: "The restaurant is closed at that time. Please choose a time within opening hours.",
      });
      return;
    }

    // Conditional update so an order the kitchen just started (or cancelled) is not rescheduled.
    // A new time also clears any delay the kitchen added for the old one.
    const updateResult = await prisma.order.updateMany({
      where: { id: order.id, orderStatus: order.orderStatus },
      data: { scheduledAt: newScheduledAt, delayMinutes: 0, delayedUntil: null },
    });

    if (updateResult.count === 0) {
      res.status(409).json({
        success: false,
        message: "The order was updated by the restaurant. Refresh and try again.",
      });
      return;
    }

    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });

    // The new time is saved; a queue failure should not turn this into a 500.
    try {
      await scheduleOrderReminder(
        updatedOrder.id,
        newScheduledAt,
        order.branch.averagePreparationTimeMinutes
      );
      // Only orders still waiting for the restaurant can expire.
      if (updatedOrder.orderStatus === "PENDING") {
        await scheduleOrderExpiry(
          updatedOrder.id,
          orderExpiryTime(newScheduledAt, updatedOrder.createdAt, order.branch.averagePreparationTimeMinutes)
        );
      }
      if (updatedOrder.fulfillmentType === "DINE_IN") await scheduleArrivalReminder(updatedOrder.id, newScheduledAt);
    } catch (error) {
      console.error("Failed to reschedule order reminder:", error);
    }

    void notifyOrderEvent(updatedOrder.id, "RESCHEDULED");

    res.status(200).json({
      success: true,
      message: "Order rescheduled successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Reschedule order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reschedule order",
    });
  }
};
