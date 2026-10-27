
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";

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
        createdAt: true,
        completedAt: true,
        cancelledAt: true,
        branch: {
          select: {
            branchName: true,
            publicSlug: true,
            city: true,
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
