
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { CreateRestaurantRequestBody } from "../types/restaurant.types";

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
    const {
      groupName,
      legalName,
      businessEmail,
      businessPhone,
      taxNumber,
      logoUrl,
      websiteUrl,
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
    } = req.body;

    const requiredFields = {
      groupName,
      branchName,
      addressLine1,
      city,
      state,
      postalCode,
    };

    const missingField = Object.entries(requiredFields).find(
      ([, value]) => typeof value !== "string" || !value.trim()
    );

    if (missingField) {
      res.status(400).json({
        success: false,
        message: `${missingField[0]} is required`,
      });
      return;
    }

    if (!slugify(groupName) || !slugify(branchName)) {
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
    const publicSlug = `${slugify(branchName)}-${suffix.toLowerCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.restaurantGroup.create({
        data: {
          groupName: groupName.trim(),
          groupCode,
          legalName: legalName?.trim() || null,
          businessEmail: businessEmail?.trim() || null,
          businessPhone: businessPhone?.trim() || null,
          taxNumber: taxNumber?.trim() || null,
          logoUrl: logoUrl?.trim() || null,
          websiteUrl: websiteUrl?.trim() || null,
          createdBy: userId,
        },
      });

      const branch = await tx.branch.create({
        data: {
          restaurantGroupId: group.id,
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
        },
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
