
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";

export const getPublicBranchMenu = async (req: Request<{ publicSlug: string }>,res: Response): Promise<void> => {
  try {
    const {publicSlug} = req.params;

    if (!publicSlug?.trim()) {
      res.status(400).json({
        success: false,
        message: "Branch slug is required",
      });
      return;
    }

    const branch = await prisma.branch.findFirst({
      where: {
        publicSlug,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        branchName: true,
        publicSlug: true,
        city: true,
        acceptsDelivery: true,
        acceptsPickup: true,
        acceptsDineIn: true,

        categories: {
          where: {
            isActive: true,
          },
          orderBy: [
            { displayOrder: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            displayOrder: true,

            menuItems: {
              where: {
                status: "ACTIVE",
                isAvailable: true,
                deletedAt: null,
              },
              orderBy: [
                { displayOrder: "asc" },
                { createdAt: "asc" },
              ],
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                imageUrl: true,
                basePrice: true,
                isVegetarian: true,
                isVegan: true,
                isGlutenFree: true,
                preparationTimeMinutes: true,

                variants: {
                  where: {
                    isAvailable: true,
                  },
                  orderBy: [
                    { displayOrder: "asc" },
                    { createdAt: "asc" },
                  ],
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    isDefault: true,
                    displayOrder: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        message: "Restaurant branch not found or unavailable",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Menu fetched successfully",
      data: branch,
    });
  } catch (error) {
    console.error("Get public menu error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
    });
  }
};
