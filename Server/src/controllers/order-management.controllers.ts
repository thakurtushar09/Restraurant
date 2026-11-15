import type { Request, Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { UpdateOrderStatusRequestBody, DelayOrderRequestBody } from "../types/order.types";
import { cancelOrderReminder, cancelOrderExpiry } from "../utils/schedule-order-reminder";
import { notifyOrderEvent, type OrderEvent } from "../utils/notify";
type BranchParams = { branchId: string };
type OrderParams = { branchId: string; orderId: string };

const SHIFT_HOURS = 12;

type OrderStatus =| "PENDING"| "ACCEPTED"| "PREPARING"| "READY"| "OUT_FOR_DELIVERY"| "COMPLETED"| "REJECTED"| "EXPIRED"| "CANCELLED";

export const getBranchOrders = async (req: Request<BranchParams>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const role = res.locals.membershipRole as string;

    // Kitchen and delivery see their live work plus what they finished this shift.
    const shiftStart = new Date(Date.now() - SHIFT_HOURS * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        branchId,
        ...(role === "KITCHEN_STAFF"
          ? {
            OR: [
              { orderStatus: { in: ["ACCEPTED", "PREPARING", "READY"] } },
              { orderStatus: { in: ["OUT_FOR_DELIVERY", "COMPLETED"] }, readyAt: { gte: shiftStart } },
            ],
          }
          : role === "DELIVERY_STAFF"
            ? {
              OR: [
                { orderStatus: { in: ["READY", "OUT_FOR_DELIVERY"] } },
                { orderStatus: "COMPLETED", completedAt: { gte: shiftStart } },
              ],
            }
            : {}),
      },
      include: {
        orderItems: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get branch orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

export const updateOrderStatus = async (req: Request<OrderParams, {}, UpdateOrderStatusRequestBody>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const role = res.locals.membershipRole as string;
    const { orderId } = req.params;
    const { status, rejectionReason } = req.body;

    const allowedStatuses: OrderStatus[] = [
      "ACCEPTED",
      "REJECTED",
      "PREPARING",
      "READY",
      "OUT_FOR_DELIVERY",
      "COMPLETED",
      "CANCELLED",
    ];

    if(!allowedStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
      return;
    }

    if (status === "REJECTED" && !rejectionReason?.trim()) {
      res.status(400).json({
        success: false,
        message: "A rejection reason is required",
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      select: {
        id: true,
        orderStatus: true,
        fulfillmentType: true,
      },
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found in this branch",
      });
      return;
    }

    const transitions: Record<string, string[]> = {
      PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
      ACCEPTED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY:
        order.fulfillmentType === "DELIVERY"
          ? ["OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"]
          : ["COMPLETED", "CANCELLED"],
      OUT_FOR_DELIVERY: ["COMPLETED"],
    };

    if (!transitions[order.orderStatus]?.includes(status)) {
      res.status(409).json({
        success: false,
        message: `Cannot change order from ${order.orderStatus} to ${status}`,
      });
      return;
    }

    const isManagementRole = [
      "GROUP_OWNER",
      "GROUP_ADMIN",
      "BRANCH_MANAGER",
    ].includes(role);

    const isKitchenTransition =
      ["PREPARING", "READY"].includes(status) &&
      ["KITCHEN_STAFF", "BRANCH_MANAGER"].includes(role);

    const isDeliveryTransition =
      ["OUT_FOR_DELIVERY", "COMPLETED"].includes(status) &&
      ["DELIVERY_STAFF", "BRANCH_MANAGER"].includes(role);

    const isManagerOnlyTransition =
      ["ACCEPTED", "REJECTED", "CANCELLED"].includes(status) &&
      isManagementRole;

    if (
      !isManagerOnlyTransition &&
      !isKitchenTransition &&
      !isDeliveryTransition &&
      !isManagementRole
    ) {
      res.status(403).json({
        success: false,
        message: "Your role cannot perform this order transition",
      });
      return;
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          branchId,
          orderStatus: order.orderStatus,
        },
        data: {
          orderStatus: status,
          ...(status === "ACCEPTED" && { acceptedAt: now }),
          ...(status === "PREPARING" && { preparingAt: now }),
          ...(status === "READY" && { readyAt: now }),
          ...(status === "OUT_FOR_DELIVERY" && {
            outForDeliveryAt: now,
          }),
          ...(status === "COMPLETED" && { completedAt: now }),
          ...(status === "CANCELLED" && { cancelledAt: now }),
          ...(status === "REJECTED" && {
            rejectionReason: rejectionReason!.trim(),
          }),
          ...(status === "CANCELLED" && {
            cancellationReason: rejectionReason?.trim() || null,
          }),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("ORDER_STATUS_CHANGED");
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { orderItems: true },
      });
    });

    try {
      // Once the restaurant acts on a pending order it can no longer expire.
      if (order.orderStatus === "PENDING") await cancelOrderExpiry(orderId);
      if (["CANCELLED", "REJECTED"].includes(status)) await cancelOrderReminder(orderId);
    } catch (error) {
      console.error("Failed to update order jobs:", error);
    }

    const events: Record<string, OrderEvent> = {
      ACCEPTED: "ACCEPTED",
      REJECTED: "REJECTED",
      PREPARING: "PREPARING",
      READY: "READY",
      OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED_BY_RESTAURANT",
    };
    void notifyOrderEvent(orderId, events[status]);

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_STATUS_CHANGED") {
      res.status(409).json({
        success: false,
        message: "The order was updated by another request. Refresh and try again.",
      });
      return;
    }

    console.error("Update order status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};
// Extra time a kitchen can ask for in one go, and in total for an order.
const DELAY_STEP_MAX = 60;
const DELAY_TOTAL_MAX = 180;

// The kitchen is running behind: push the ready time back and tell the guest.
export const delayOrder = async (req: Request<OrderParams, {}, DelayOrderRequestBody>, res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const role = res.locals.membershipRole as string;
    const { orderId } = req.params;
    const minutes = Number(req.body?.minutes);

    if (!["GROUP_OWNER", "GROUP_ADMIN", "BRANCH_MANAGER", "KITCHEN_STAFF"].includes(role)) {
      res.status(403).json({ success: false, message: "Your role cannot change an order's timing" });
      return;
    }

    if (!Number.isInteger(minutes) || minutes < 1 || minutes > DELAY_STEP_MAX) {
      res.status(400).json({ success: false, message: `Add between 1 and ${DELAY_STEP_MAX} minutes` });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId },
      select: {
        orderStatus: true,
        scheduledAt: true,
        acceptedAt: true,
        createdAt: true,
        delayMinutes: true,
        delayedUntil: true,
        branch: { select: { averagePreparationTimeMinutes: true } },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found in this branch" });
      return;
    }

    if (!["ACCEPTED", "PREPARING"].includes(order.orderStatus)) {
      res.status(409).json({ success: false, message: "Only accepted or cooking orders can be given more time" });
      return;
    }

    if (order.delayMinutes + minutes > DELAY_TOTAL_MAX) {
      res.status(400).json({ success: false, message: `An order can be pushed back by at most ${DELAY_TOTAL_MAX} minutes in total` });
      return;
    }

    // Ready time before this delay: the last delayed time, else the guest's time, else accepted + prep.
    const prepMs = order.branch.averagePreparationTimeMinutes * 60 * 1000;
    const plannedReady = order.delayedUntil
      ?? order.scheduledAt
      ?? new Date((order.acceptedAt ?? order.createdAt).getTime() + prepMs);
    // Never promise a time that has already gone by.
    const from = Math.max(plannedReady.getTime(), Date.now());

    const result = await prisma.order.updateMany({
      where: { id: orderId, branchId, orderStatus: order.orderStatus, delayMinutes: order.delayMinutes },
      data: {
        delayMinutes: order.delayMinutes + minutes,
        delayedUntil: new Date(from + minutes * 60 * 1000),
      },
    });

    if (result.count === 0) {
      res.status(409).json({ success: false, message: "The order was updated by another request. Refresh and try again." });
      return;
    }

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { orderItems: true },
    });

    void notifyOrderEvent(orderId, "DELAYED");

    res.status(200).json({
      success: true,
      message: `Added ${minutes} minutes. The customer has been told.`,
      data: updated,
    });
  } catch (error) {
    console.error("Delay order error:", error);
    res.status(500).json({ success: false, message: "Failed to update the order's timing" });
  }
};
