
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";

export async function canManageBranch(req: Request,res: Response,next: NextFunction):Promise<void>{
  try {
    const userId = res.locals.userId as string | undefined;
    const branchId = req.params.branchId;

    if(!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if(typeof branchId !== "string" || !branchId) {
      res.status(400).json({
        success: false,
        message: "Branch ID is required",
      });
      return;
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        deletedAt: null,
        status: { not: "CLOSED" },
      },
      select: {
        id: true,
        restaurantGroupId: true,
      },
    });

    if(!branch){
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
            role: "BRANCH_MANAGER",
            branchId: branch.id,
          },
        ],
      },
      select: { id: true },
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to manage this branch",
      });
      return;
    }

    res.locals.branchId = branch.id;
    res.locals.restaurantGroupId = branch.restaurantGroupId;

    next();
  } catch (error) {
    console.error("Branch permission check failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify branch permissions",
    });
  }
}
