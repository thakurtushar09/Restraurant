
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";

export async function canAccessBranchOrders(req: Request,res: Response,next: NextFunction): Promise<void> {
  try {
    const userId = res.locals.userId as string | undefined;
    const branchId = req.params.branchId as string | undefined;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        restaurantGroupId: true,
      },
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        message: "Branch not found",
      });
      return;
    }

    const membership = await prisma.restaurantMember.findFirst({
      where: {
        userId,
        restaurantGroupId: branch.restaurantGroupId,
        status: "ACTIVE",
        OR: [
          {
            role: { in: ["GROUP_OWNER", "GROUP_ADMIN"] },
            branchId: null,
          },
          {
            role: {
              in: [
                "BRANCH_MANAGER",
                "KITCHEN_STAFF",
                "DELIVERY_STAFF",
              ],
            },
            branchId: branch.id,
          },
        ],
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to access these orders",
      });
      return;
    }

    res.locals.branchId = branch.id;
    res.locals.restaurantGroupId = branch.restaurantGroupId;
    res.locals.membershipRole = membership.role;

    next();
  } catch (error) {
    console.error("Order access check failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to verify order permissions",
    });
  }
}
