
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { RescheduleOrderRequestBody } from "../types/order.types";
import { scheduleOrderReminder } from "../utils/schedule-order-reminder";

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

    if (
      !scheduledAt ||
      Number.isNaN(newScheduledAt.getTime()) ||
      newScheduledAt.getTime() <= Date.now()
    ) {
      res.status(400).json({
        success: false,
        message: "A valid future scheduled time is required",
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        orderStatus: "PENDING",
        scheduledAt: { not: null },
      },
      include: {
        branch: {
          select: {
            averagePreparationTimeMinutes: true,
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

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { scheduledAt: newScheduledAt },
    });

    await scheduleOrderReminder(
      updatedOrder.id,
      newScheduledAt,
      order.branch.averagePreparationTimeMinutes
    );

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
