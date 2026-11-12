import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { CreateBranchRequestBody, UpdateBranchRequestBody } from "../types/restaurant.types";
import { InputError, parseBranchFields, assertFulfillment } from "../utils/branch-input";

type BranchParams = { groupId: string; branchId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const slugify = (value: string): string =>value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Owners/admins can edit any branch in the group; branch managers only their own.
async function canEditBranch(userId: string, groupId: string, branchId: string): Promise<boolean> {
  const membership = await prisma.restaurantMember.findFirst({
    where: {
      userId,
      restaurantGroupId: groupId,
      status: "ACTIVE",
      OR: [
        { role: { in: ["GROUP_OWNER", "GROUP_ADMIN"] }, branchId: null },
        { role: "BRANCH_MANAGER", branchId },
      ],
    },
    select: { id: true },
  });

  return Boolean(membership);
}

function sendInputError(res: Response, error: unknown): boolean {
  if (error instanceof InputError) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
    return true;
  }
  return false;
}

export const createBranch = async (req:Request<{ groupId: string }, {}, CreateBranchRequestBody>,res:Response):Promise<void> => {
  try {
    const userId = res.locals.userId as string | undefined;
    const { groupId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!UUID.test(groupId)) {
      res.status(400).json({
        success: false,
        message: "Invalid restaurant group ID",
      });
      return;
    }

    const fields = parseBranchFields(req.body, "create");
    assertFulfillment(fields);

    if (!slugify(fields.branchName!)){
      res.status(400).json({
        success: false,
        message: "Branch name must contain letters or numbers",
      });
      return;
    }

    // Only active group owners and group admins can add branches.
    const membership = await prisma.restaurantMember.findFirst({
      where: {
        userId,
        restaurantGroupId: groupId,
        status: "ACTIVE",
        role: { in: ["GROUP_OWNER", "GROUP_ADMIN"] },
        branchId: null,
      },
      select: { id: true },
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to add branches to this restaurant",
      });
      return;
    }

    const suffix = randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

    const branchCode = `BR-${suffix}`;
    const publicSlug = `${slugify(fields.branchName!)}-${suffix.toLowerCase()}`;

    const branch = await prisma.branch.create({
      data: {
        ...fields,
        restaurantGroupId: groupId,
        branchCode,
        publicSlug,
      } as Prisma.BranchUncheckedCreateInput,
    });

    res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: branch,
    });
  } catch (error) {
    if (sendInputError(res, error)) return;

    console.error("Create branch error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        success: false,
        message: "A unique value already exists. Please try again.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to create branch",
    });
  }
};

export const getBranch = async (req: Request<BranchParams>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { groupId, branchId } = req.params;

    if (!UUID.test(groupId) || !UUID.test(branchId)) {
      res.status(400).json({
        success: false,
        message: "Invalid restaurant or branch ID",
      });
      return;
    }

    if (!(await canEditBranch(userId, groupId, branchId))) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to view this branch",
      });
      return;
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, restaurantGroupId: groupId, deletedAt: null },
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        message: "Branch not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: branch,
    });
  } catch (error) {
    console.error("Get branch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch branch",
    });
  }
};

export const updateBranch = async (req: Request<BranchParams, {}, UpdateBranchRequestBody>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { groupId, branchId } = req.params;

    if (!UUID.test(groupId) || !UUID.test(branchId)) {
      res.status(400).json({
        success: false,
        message: "Invalid restaurant or branch ID",
      });
      return;
    }

    const fields = parseBranchFields(req.body, "update");

    if (Object.keys(fields).length === 0) {
      res.status(400).json({
        success: false,
        message: "Nothing to update",
      });
      return;
    }

    if (!(await canEditBranch(userId, groupId, branchId))) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to edit this branch",
      });
      return;
    }

    const existing = await prisma.branch.findFirst({
      where: { id: branchId, restaurantGroupId: groupId, deletedAt: null, status: { not: "CLOSED" } },
      select: { acceptsDelivery: true, acceptsPickup: true, acceptsDineIn: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Branch not found",
      });
      return;
    }

    assertFulfillment({ ...existing, ...fields });

    if (fields.branchName !== undefined && !slugify(fields.branchName)) {
      res.status(400).json({
        success: false,
        message: "Branch name must contain letters or numbers",
      });
      return;
    }

    // The public slug and branch code stay fixed so customer links keep working.
    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: fields as Prisma.BranchUncheckedUpdateInput,
    });

    res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      data: branch,
    });
  } catch (error) {
    if (sendInputError(res, error)) return;

    console.error("Update branch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update branch",
    });
  }
};
