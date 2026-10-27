
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type {CreateMenuItemRequestBody,UpdateMenuItemRequestBody,} from "../types/restaurant.types";
import { randomUUID } from "node:crypto";

type BranchParams = { branchId: string };
type ItemParams = { branchId: string; itemId: string };

export const createMenuItem = async (req: Request<BranchParams, {}, CreateMenuItemRequestBody>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const {
      categoryId,
      name,
      description,
      imageUrl,
      basePrice,
      isVegetarian,
      isVegan,
      isGlutenFree,
      preparationTimeMinutes,
    } = req.body;

    if (typeof categoryId !== "string" ||typeof name !== "string" ||!name.trim()) {
      res.status(400).json({
        success: false,
        message: "Category ID and item name are required",
      });
      return;
    }

    if (typeof basePrice !== "number" ||!Number.isFinite(basePrice) ||basePrice < 0) {
      res.status(400).json({
        success: false,
        message: "Base price must be a non-negative number",
      });
      return;
    }

    if (preparationTimeMinutes !== undefined &&(!Number.isInteger(preparationTimeMinutes) ||preparationTimeMinutes < 0)) {
      res.status(400).json({
        success: false,
        message: "Preparation time must be a non-negative integer",
      });
      return;
    }

    const category = await prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        branchId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!category) {
      res.status(400).json({
        success: false,
        message: "Active category not found in this branch",
      });
      return;
    }

    const slugBase = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slugBase) {
      res.status(400).json({
        success: false,
        message: "Item name must contain letters or numbers",
      });
      return;
    }

    // Unique per branch, including items previously archived.
    const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;

    const item = await prisma.menuItem.create({
      data: {
        branchId,
        categoryId,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        basePrice,
        isVegetarian: isVegetarian ?? false,
        isVegan: isVegan ?? false,
        isGlutenFree: isGlutenFree ?? false,
        preparationTimeMinutes: preparationTimeMinutes ?? 15,
      },
    });

    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: item,
    });
  } catch (error) {
    console.error("Create menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create menu item",
    });
  }
};

export const getBranchMenuItems = async (req: Request<BranchParams>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;

    const items = await prisma.menuItem.findMany({
      where: { branchId, deletedAt: null },
      include: {
        category: {
          select: { id: true, name: true },
        },
        variants: {
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("Get menu items error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
    });
  }
};

export const updateMenuItem = async (req: Request<ItemParams, {}, UpdateMenuItemRequestBody>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const { itemId } = req.params;
    const body = req.body;

    const existing = await prisma.menuItem.findFirst({
      where: { id: itemId, branchId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Menu item not found in this branch",
      });
      return;
    }

    if (body.name !== undefined &&(typeof body.name !== "string" || !body.name.trim())) {
      res.status(400).json({
        success: false,
        message: "Item name cannot be empty",
      });
      return;
    }

    if (body.basePrice !== undefined &&(!Number.isFinite(body.basePrice) || body.basePrice < 0)) {
      res.status(400).json({
        success: false,
        message: "Base price must be a non-negative number",
      });
      return;
    }

    if (body.preparationTimeMinutes !== undefined &&(!Number.isInteger(body.preparationTimeMinutes) ||body.preparationTimeMinutes < 0)) {
      res.status(400).json({
        success: false,
        message: "Preparation time must be a non-negative integer",
      });
      return;
    }

    if (body.categoryId !== undefined) {
      const category = await prisma.menuCategory.findFirst({
        where: {
          id: body.categoryId,
          branchId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!category) {
        res.status(400).json({
          success: false,
          message: "Active category not found in this branch",
        });
        return;
      }
    }

    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(body.categoryId !== undefined && {
          categoryId: body.categoryId,
        }),
        ...(body.name !== undefined && {
          name: body.name.trim(),
        }),
        ...(body.description !== undefined && {
          description: body.description?.trim() || null,
        }),
        ...(body.imageUrl !== undefined && {
          imageUrl: body.imageUrl?.trim() || null,
        }),
        ...(body.basePrice !== undefined && {
          basePrice: body.basePrice,
        }),
        ...(body.isVegetarian !== undefined && {
          isVegetarian: body.isVegetarian,
        }),
        ...(body.isVegan !== undefined && {
          isVegan: body.isVegan,
        }),
        ...(body.isGlutenFree !== undefined && {
          isGlutenFree: body.isGlutenFree,
        }),
        ...(body.preparationTimeMinutes !== undefined && {
          preparationTimeMinutes: body.preparationTimeMinutes,
        }),
        ...(body.status !== undefined && {
          status: body.status,
        }),
        ...(body.isAvailable !== undefined && {
          isAvailable: body.isAvailable,
        }),
        ...(body.displayOrder !== undefined && {
          displayOrder: body.displayOrder,
        }),
      },
    });

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: item,
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update menu item",
    });
  }
};

export const archiveMenuItem = async (
  req: Request<ItemParams>,
  res: Response
): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const { itemId } = req.params;

    const existing = await prisma.menuItem.findFirst({
      where: { id: itemId, branchId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Menu item not found in this branch",
      });
      return;
    }

    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        status: "ARCHIVED",
        isAvailable: false,
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Menu item archived successfully",
      data: item,
    });
  } catch (error) {
    console.error("Archive menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to archive menu item",
    });
  }
};
