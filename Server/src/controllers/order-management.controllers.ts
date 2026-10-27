
import type { Request, Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { UpdateOrderStatusRequestBody } from "../types/order.types";

type BranchParams = { branchId: string };
type OrderParams = { branchId: string; orderId: string };

type OrderStatus =| "PENDING"| "ACCEPTED"| "PREPARING"| "READY"| "OUT_FOR_DELIVERY"| "COMPLETED"| "REJECTED"| "EXPIRED"| "CANCELLED";

export const getBranchOrders = async (req: Request<BranchParams>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const role = res.locals.membershipRole as string;

    const orders = await prisma.order.findMany({
      where: {
        branchId,
        ...(role === "KITCHEN_STAFF"
          ? { orderStatus: { in: ["ACCEPTED", "PREPARING", "READY"] } }
          : role === "DELIVERY_STAFF"
            ? { orderStatus: { in: ["READY", "OUT_FOR_DELIVERY"] } }
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
