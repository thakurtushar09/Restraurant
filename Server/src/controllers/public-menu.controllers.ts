
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { Prisma } from "../generated/prisma/client";

type ExploreQuery = {
  q?: string;
  city?: string;
  fulfillment?: string;
};

export const getPublicBranches = async (
  req: Request<Record<string, never>, unknown, unknown, ExploreQuery>,
  res: Response,
): Promise<void> => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const fulfillment = typeof req.query.fulfillment === "string"
      ? req.query.fulfillment.trim().toUpperCase()
      : "";

    if (query.length > 100 || city.length > 100) {
      res.status(400).json({ success: false, message: "Search terms must be 100 characters or fewer" });
      return;
    }

    if (fulfillment && fulfillment !== "DELIVERY" && fulfillment !== "PICKUP") {
      res.status(400).json({ success: false, message: "Fulfillment must be DELIVERY or PICKUP" });
      return;
    }

    const where: Prisma.BranchWhereInput = {
      status: "ACTIVE",
      deletedAt: null,
      restaurantGroup: { status: "ACTIVE", deletedAt: null },
      ...(fulfillment === "DELIVERY" ? { acceptsDelivery: true } : {}),
      ...(fulfillment === "PICKUP" ? { acceptsPickup: true } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
      ...(query ? {
        OR: [
          { branchName: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { state: { contains: query, mode: "insensitive" } },
          { postalCode: { contains: query, mode: "insensitive" } },
          { restaurantGroup: { groupName: { contains: query, mode: "insensitive" } } },
        ],
      } : {}),
    };

    const branches = await prisma.branch.findMany({
      where,
      orderBy: [{ branchName: "asc" }, { city: "asc" }],
      select: {
        id: true,
        branchName: true,
        publicSlug: true,
        addressLine1: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        averagePreparationTimeMinutes: true,
        acceptsDelivery: true,
        acceptsPickup: true,
        restaurantGroup: {
          select: { groupName: true, logoUrl: true },
        },
        menuItems: {
          where: { status: "ACTIVE", isAvailable: true, deletedAt: null, category: { isActive: true } },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          take: 3,
          select: { name: true, imageUrl: true, basePrice: true },
        },
        _count: {
          select: {
            menuItems: {
              where: { status: "ACTIVE", isAvailable: true, deletedAt: null, category: { isActive: true } },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Available restaurants fetched successfully",
      data: branches.map((branch) => ({
        ...branch,
        menuItems: branch.menuItems.map((item) => ({ ...item, basePrice: Number(item.basePrice) })),
      })),
    });
  } catch (error) {
    console.error("Get public restaurants error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch restaurants" });
  }
};

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
        addressLine1: true,
        city: true,
        state: true,
        averagePreparationTimeMinutes: true,
        acceptsDelivery: true,
        acceptsPickup: true,
        acceptsDineIn: true,
        restaurantGroup: { select: { groupName: true, logoUrl: true } },

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
