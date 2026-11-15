
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { Prisma } from "../generated/prisma/client";
import { distanceKm, toPoint, NEARBY_RADIUS_KM, type Point } from "../utils/geo";

type ExploreQuery = {
  q?: string;
  city?: string;
  fulfillment?: string;
  lat?: string;
  lng?: string;
};

// Customer location from ?lat=&lng= (both or neither).
function readLocation(query: ExploreQuery): Point | null | "invalid" {
  if (query.lat === undefined && query.lng === undefined) return null;
  const point = toPoint(query.lat, query.lng);
  if (!point || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) return "invalid";
  return point;
}

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

    if (fulfillment && fulfillment !== "DELIVERY" && fulfillment !== "PREORDER") {
      res.status(400).json({ success: false, message: "Fulfillment must be DELIVERY or PREORDER" });
      return;
    }

    const location = readLocation(req.query);
    if (location === "invalid") {
      res.status(400).json({ success: false, message: "Location must be a valid latitude and longitude" });
      return;
    }

    const where: Prisma.BranchWhereInput = {
      status: "ACTIVE",
      deletedAt: null,
      restaurantGroup: { status: "ACTIVE", deletedAt: null },
      ...(fulfillment === "DELIVERY" ? { acceptsDelivery: true } : {}),
      // Branches without a map pin can't be measured, so they're left out of nearby results.
      ...(location ? { latitude: { not: null }, longitude: { not: null } } : {}),
      ...(fulfillment === "PREORDER" ? { acceptsDineIn: true } : {}),
      // Only list branches that take delivery or pre-orders (pickup is switched off for now).
      AND: [{ OR: [{ acceptsDelivery: true }, { acceptsDineIn: true }] }],
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
        latitude: true,
        longitude: true,
        deliveryRadiusKm: true,
        averagePreparationTimeMinutes: true,
        acceptsDelivery: true,
        acceptsDineIn: true,
        restaurantGroupId: true,
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

    let results = branches.map((branch) => {
      const point = toPoint(branch.latitude, branch.longitude);
      const distance = location && point ? distanceKm(location, point) : null;
      return {
        ...branch,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
        deliversToYou: distance === null ? null : branch.acceptsDelivery && distance <= branch.deliveryRadiusKm,
        menuItems: branch.menuItems.map((item) => ({ ...item, basePrice: Number(item.basePrice) })),
      };
    });

    if (location) {
      // Within range (delivery needs the branch's own radius), then only each restaurant's closest branch.
      results = results
        .filter((branch) => fulfillment === "DELIVERY" ? branch.deliversToYou : branch.distanceKm! <= NEARBY_RADIUS_KM)
        .sort((a, b) => a.distanceKm! - b.distanceKm!);
      const seenGroups = new Set<string>();
      results = results.filter((branch) => {
        if (seenGroups.has(branch.restaurantGroupId)) return false;
        seenGroups.add(branch.restaurantGroupId);
        return true;
      });
    }

    res.status(200).json({
      success: true,
      message: "Available restaurants fetched successfully",
      data: results,
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
        postalCode: true,
        latitude: true,
        longitude: true,
        deliveryRadiusKm: true,
        averagePreparationTimeMinutes: true,
        acceptsDelivery: true,
        acceptsDineIn: true,
        currency: true,
        timezone: true,
        openingHours: true,
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

    const point = toPoint(branch.latitude, branch.longitude);

    res.status(200).json({
      success: true,
      message: "Menu fetched successfully",
      data: { ...branch, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null },
    });
  } catch (error) {
    console.error("Get public menu error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
    });
  }
};
