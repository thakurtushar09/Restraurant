
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { CreateMenuItemVariantRequestBody } from "../types/restaurant.types";

type VariantParams = { branchId: string; itemId: string };

export const createMenuItemVariant = async (req: Request<VariantParams, {}, CreateMenuItemVariantRequestBody>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const { itemId } = req.params;
    const { name, price, isDefault, isAvailable, displayOrder } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Variant name is required",
      });
      return;
    }

    if (typeof price !== "number" ||!Number.isFinite(price) ||price < 0) {
      res.status(400).json({
        success: false,
        message: "Variant price must be a non-negative number",
      });
      return;
    }

    if (displayOrder !== undefined &&(!Number.isInteger(displayOrder) || displayOrder < 0)) {
      res.status(400).json({
        success: false,
        message: "Display order must be a non-negative integer",
      });
      return;
    }

    const item = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        branchId,
        deletedAt: null,
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    });

    if(!item) {
      res.status(404).json({
        success: false,
        message: "Menu item not found in this branch",
      });
      return;
    }

    const variant = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.menuItemVariant.updateMany({
          where: { menuItemId: itemId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.menuItemVariant.create({
        data: {
          menuItemId: itemId,
          name: name.trim(),
          price,
          isDefault: isDefault ?? false,
          isAvailable: isAvailable ?? true,
          displayOrder: displayOrder ?? 0,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Menu item variant created successfully",
      data: variant,
    });
  } catch (error) {
    console.error("Create menu variant error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create menu item variant",
    });
  }
};

export const getMenuItemVariants = async (req: Request<VariantParams>,res: Response):Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const { itemId } = req.params;

    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, branchId, deletedAt: null },
      select: { id: true },
    });

    if (!item) {
      res.status(404).json({
        success: false,
        message: "Menu item not found in this branch",
      });
      return;
    }

    const variants = await prisma.menuItemVariant.findMany({
      where: { menuItemId: itemId },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    res.status(200).json({
      success: true,
      data: variants,
    });
  } catch (error) {
    console.error("Get menu variants error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch variants",
    });
  }
};
