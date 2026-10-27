
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { CreateBranchRequestBody } from "../types/restaurant.types";

const slugify = (value: string): string =>value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(groupId)) {
      res.status(400).json({
        success: false,
        message: "Invalid restaurant group ID",
      });
      return;
    }

    const {
      branchName,
      phone,
      email,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      postalCode,
      country,
      timezone,
      currency,
      averagePreparationTimeMinutes,
      acceptsDelivery,
      acceptsPickup,
      acceptsDineIn,
    } = req.body;

    const requiredFields = {
      branchName,
      addressLine1,
      city,
      state,
      postalCode,
    };

    const missingField = Object.entries(requiredFields).find(([, value]) => typeof value !== "string" || !value.trim());

    if (missingField){
      res.status(400).json({
        success: false,
        message: `${missingField[0]} is required`,
      });
      return;
    }

    if (!slugify(branchName)){
      res.status(400).json({
        success: false,
        message: "Branch name must contain letters or numbers",
      });
      return;
    }

    if (averagePreparationTimeMinutes !== undefined &&(!Number.isInteger(averagePreparationTimeMinutes) ||averagePreparationTimeMinutes < 0)) {
      res.status(400).json({
        success: false,
        message: "Preparation time must be a non-negative integer",
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
    const publicSlug = `${slugify(branchName)}-${suffix.toLowerCase()}`;

    const branch = await prisma.branch.create({
      data: {
        restaurantGroupId: groupId,
        branchName: branchName.trim(),
        branchCode,
        publicSlug,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2?.trim() || null,
        landmark: landmark?.trim() || null,
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        country: country?.trim() || "India",
        timezone: timezone?.trim() || "Asia/Kolkata",
        currency: currency?.trim() || "INR",
        averagePreparationTimeMinutes:
          averagePreparationTimeMinutes ?? 30,
        acceptsDelivery: acceptsDelivery ?? true,
        acceptsPickup: acceptsPickup ?? true,
        acceptsDineIn: acceptsDineIn ?? false,
      },
    });

    res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: branch,
    });
  } catch (error) {
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
