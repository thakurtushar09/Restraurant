
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type {CreateMenuCategoryRequestBody,UpdateMenuCategoryRequestBody,} from "../types/restaurant.types";
import { randomUUID } from "node:crypto";
type BranchParams = { branchId: string };
type CategoryParams = { branchId: string; categoryId: string };

export const createMenuCategory = async (req: Request<BranchParams, {}, CreateMenuCategoryRequestBody>,res: Response): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const { name, description, imageUrl, displayOrder } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Category name is required",
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

    const category = await prisma.menuCategory.create({
      data: {
        branchId,
        name: name.trim(),
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        displayOrder: displayOrder ?? 0,
      },
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

export const getMenuCategories = async (
  req: Request<BranchParams>,
  res: Response
): Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;

    const categories = await prisma.menuCategory.findMany({
      where: { branchId },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

export const updateMenuCategory = async (req: Request<CategoryParams, {}, UpdateMenuCategoryRequestBody>,res: Response):Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const { categoryId } = req.params;
    const { name, description, imageUrl, displayOrder, isActive } = req.body;

    if (name !== undefined &&(typeof name !== "string" || !name.trim())){
      res.status(400).json({
        success: false,
        message: "Category name cannot be empty",
      });
      return;
    }
    if (
      displayOrder !== undefined &&
      (!Number.isInteger(displayOrder) || displayOrder < 0)
    ) {
      res.status(400).json({
        success: false,
        message: "Display order must be a non-negative integer",
      });
      return;
    }

    const existing = await prisma.menuCategory.findFirst({
      where: { id: categoryId, branchId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Category not found for this branch",
      });
      return;
    }

    const category = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(imageUrl !== undefined && {
          imageUrl: imageUrl?.trim() || null,
        }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

export const deactivateMenuCategory = async (req: Request<CategoryParams>,res: Response):Promise<void> => {
  try {
    const branchId = res.locals.branchId as string;
    const { categoryId } = req.params;
    const existing = await prisma.menuCategory.findFirst({
      where: { id: categoryId, branchId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Category not found for this branch",
      });
      return;
    }

    const category = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    res.status(200).json({
      success: true,
      message: "Category deactivated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Deactivate category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate category",
    });
  }
};
