
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { CancelOrderRequestBody } from "../types/order.types";
import { cancelOrderReminder, cancelOrderExpiry } from "../utils/schedule-order-reminder";
import { notifyOrderEvent } from "../utils/notify";

export const getMyOrders = async (req: Request,res: Response):Promise<void> => {
  try {
    const userId = res.locals.userId as string;

    const orders = await prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        paymentStatus: true,
        fulfillmentType: true,
        currency: true,
        totalAmount: true,
        scheduledAt: true,
        delayMinutes: true,
        delayedUntil: true,
        partySize: true,
        tableNumber: true,
        createdAt: true,
        completedAt: true,
        cancelledAt: true,
        branch: {
          select: {
            branchName: true,
            publicSlug: true,
            city: true,
            restaurantGroup: { select: { groupName: true } },
          },
        },
        orderItems: {
          select: {
            id: true,
            itemName: true,
            variantName: true,
            unitPrice: true,
            quantity: true,
            lineTotal: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get customer orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your orders",
    });
  }
};

export const getMyOrderDetails = async (req: Request<{ orderId: string }>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        branch: {
          select: {
            branchName: true,
            publicSlug: true,
            phone: true,
            addressLine1: true,
            city: true,
            state: true,
            postalCode: true,
            averagePreparationTimeMinutes: true,
            openingHours: true,
            timezone: true,
            restaurantGroup: { select: { groupName: true } },
          },
        },
        orderItems: {
          select: {
            id: true,
            itemName: true,
            variantName: true,
            unitPrice: true,
            quantity: true,
            lineTotal: true,
            customizations: true,
            specialInstructions: true,
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order details error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
    });
  }
};

// Customers can cancel only before the restaurant accepts the order.
export const cancelMyOrder = async (req: Request<{ orderId: string }, {}, CancelOrderRequestBody>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { orderId } = req.params;
    const cancellationReason = req.body?.cancellationReason;

    if (cancellationReason !== undefined &&(typeof cancellationReason !== "string" || cancellationReason.length > 500)) {
      res.status(400).json({
        success: false,
        message: "Cancellation reason must be text of 500 characters or fewer",
      });
      return;
    }

    const updateResult = await prisma.order.updateMany({
      where: {
        id: orderId,
        userId,
        orderStatus: "PENDING",
      },
      data: {
        orderStatus: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: cancellationReason?.trim() || "Cancelled by customer",
      },
    });

    if (updateResult.count === 0) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, userId },
        select: { orderStatus: true },
      });

      if (!order) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      res.status(409).json({
        success: false,
        message: `Order can no longer be cancelled (status: ${order.orderStatus})`,
      });
      return;
    }

    try {
      await cancelOrderReminder(orderId);
      await cancelOrderExpiry(orderId);
    } catch (error) {
      console.error("Failed to cancel order reminder:", error);
    }

    void notifyOrderEvent(orderId, "CANCELLED_BY_CUSTOMER");

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { orderItems: true },
    });

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    console.error("Cancel order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
};
