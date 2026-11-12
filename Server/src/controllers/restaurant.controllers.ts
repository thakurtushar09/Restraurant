import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { CreateRestaurantRequestBody } from "../types/restaurant.types";
import {InputReader,InputError,parseBranchFields,assertFulfillment,patterns,} from "../utils/branch-input";

const slugify = (value: string): string =>value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const createRestaurant = async (req:Request<{}, {}, CreateRestaurantRequestBody>,res:Response):Promise<void> => {
  try {
    const userId = res.locals.userId as string|undefined;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Business details
    const reader = new InputReader(req.body, "create");
    const groupName = reader.text("groupName", "Restaurant name", { required: true, max: 100 }) as string;
    const legalName = reader.text("legalName", "Legal name", { max: 150 });
    const businessEmail = reader.text("businessEmail", "Business email", { pattern: patterns.EMAIL, message: "Business email must be a valid email address" });
    const businessPhone = reader.text("businessPhone", "Business phone", { pattern: patterns.PHONE, message: "Business phone must be a valid phone number" });
    const taxNumber = reader.text("taxNumber", "Tax number", { max: 30 });
    const logoUrl = reader.text("logoUrl", "Logo URL", { max: 500, pattern: patterns.URL, message: "Logo URL must start with http:// or https://" });
    const websiteUrl = reader.text("websiteUrl", "Website", { max: 500, pattern: patterns.URL, message: "Website must start with http:// or https://" });

    // First branch details
    const branchFields = parseBranchFields(req.body, "create");
    assertFulfillment(branchFields);

    if (!slugify(groupName) || !slugify(branchFields.branchName!)) {
      res.status(400).json({
        success: false,
        message: "Restaurant and branch names must contain letters or numbers",
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account is inactive or does not exist",
      });
      return;
    }

    // Generate codes on the backend.
    const suffix = randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

    const groupCode = `${slugify(groupName).toUpperCase()}-${suffix}`;
    const branchCode = `BR-${suffix}`;
    const publicSlug = `${slugify(branchFields.branchName!)}-${suffix.toLowerCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.restaurantGroup.create({
        data: {
          groupName,
          groupCode,
          legalName: legalName ?? null,
          businessEmail: businessEmail ?? null,
          businessPhone: businessPhone ?? null,
          taxNumber: taxNumber ?? null,
          logoUrl: logoUrl ?? null,
          websiteUrl: websiteUrl ?? null,
          createdBy: userId,
        },
      });

      const branch = await tx.branch.create({
        data: {
          ...branchFields,
          restaurantGroupId: group.id,
          branchCode,
          publicSlug,
        } as Prisma.BranchUncheckedCreateInput,
      });

      const membership = await tx.restaurantMember.create({
        data: {
          userId,
          restaurantGroupId: group.id,
          branchId: null,
          role: "GROUP_OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });

      // Promote the account after successful restaurant onboarding.
      await tx.user.update({
        where: {id: userId},
        data: {userType: "RESTAURANT_OWNER"},
      });

      return {group, branch, membership};
    });

    res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Create restaurant error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError &&error.code === "P2002"){
      res.status(409).json({
        success: false,
        message: "A unique value already exists. Please try again.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to create restaurant",
    });
  }
};
