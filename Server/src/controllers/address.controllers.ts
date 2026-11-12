import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type {CreateAddressRequestBody,UpdateAddressRequestBody,} from "../types/user.types";

type AddressParams = { addressId: string };

const ADDRESS_TYPES = ["HOME", "WORK", "OTHER"];
const MAX_ADDRESSES = 20;

const addressSelect = {
  id: true,
  addressType: true,
  label: true,
  recipientName: true,
  recipientPhone: true,
  addressLine1: true,
  addressLine2: true,
  landmark: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  latitude: true,
  longitude: true,
  deliveryInstructions: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

// Returns an error message, or null when the coordinates are fine.
function validateCoordinates(latitude: unknown, longitude: unknown): string | null {
  if (latitude !== undefined &&(typeof latitude !== "number" || latitude < -90 || latitude > 90)) {
    return "Latitude must be a number between -90 and 90";
  }

  if (longitude !== undefined &&(typeof longitude !== "number" || longitude < -180 || longitude > 180)) {
    return "Longitude must be a number between -180 and 180";
  }

  return null;
}

export const createAddress = async (req: Request<{}, {}, CreateAddressRequestBody>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const {
      addressType,
      label,
      recipientName,
      recipientPhone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      postalCode,
      country,
      latitude,
      longitude,
      deliveryInstructions,
      isDefault,
    } = req.body;

    const requiredFields = { addressLine1, city, state, postalCode };

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

    if (addressType !== undefined && !ADDRESS_TYPES.includes(addressType)) {
      res.status(400).json({
        success: false,
        message: "Address type must be HOME, WORK, or OTHER",
      });
      return;
    }

    const coordinateError = validateCoordinates(latitude, longitude);

    if (coordinateError) {
      res.status(400).json({
        success: false,
        message: coordinateError,
      });
      return;
    }

    const address = await prisma.$transaction(async (tx) => {
      const activeCount = await tx.address.count({
        where: { userId, isActive: true, deletedAt: null },
      });

      if (activeCount >= MAX_ADDRESSES) {
        throw new Error("ADDRESS_LIMIT_REACHED");
      }

      // The first address always becomes the default.
      const makeDefault = isDefault === true || activeCount === 0;

      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId,
          addressType: addressType ?? "HOME",
          label: optionalText(label),
          recipientName: optionalText(recipientName),
          recipientPhone: optionalText(recipientPhone),
          addressLine1: addressLine1.trim(),
          addressLine2: optionalText(addressLine2),
          landmark: optionalText(landmark),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: optionalText(country) ?? "India",
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          deliveryInstructions: optionalText(deliveryInstructions),
          isDefault: makeDefault,
        },
        select: addressSelect,
      });
    });

    res.status(201).json({
      success: true,
      message: "Address saved successfully",
      data: address,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_LIMIT_REACHED") {
      res.status(400).json({
        success: false,
        message: `You can save up to ${MAX_ADDRESSES} addresses`,
      });
      return;
    }

    console.error("Create address error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save address",
    });
  }
};

export const getMyAddresses = async (_req: Request,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;

    const addresses = await prisma.address.findMany({
      where: { userId, isActive: true, deletedAt: null },
      select: addressSelect,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error("Get addresses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
};

export const updateAddress = async (req: Request<AddressParams, {}, UpdateAddressRequestBody>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { addressId } = req.params;
    const body = req.body ?? {};

    for (const field of ["addressLine1", "city", "state", "postalCode"] as const) {
      if (body[field] !== undefined &&(typeof body[field] !== "string" || !body[field].trim())) {
        res.status(400).json({
          success: false,
          message: `${field} cannot be empty`,
        });
        return;
      }
    }

    if (body.addressType !== undefined && !ADDRESS_TYPES.includes(body.addressType)) {
      res.status(400).json({
        success: false,
        message: "Address type must be HOME, WORK, or OTHER",
      });
      return;
    }

    const coordinateError = validateCoordinates(body.latitude, body.longitude);

    if (coordinateError) {
      res.status(400).json({
        success: false,
        message: coordinateError,
      });
      return;
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId, isActive: true, deletedAt: null },
      select: { id: true, isDefault: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    // Unsetting the default is only done by choosing another default address.
    if (body.isDefault === false && existing.isDefault) {
      res.status(400).json({
        success: false,
        message: "Set another address as default instead",
      });
      return;
    }

    const address = await prisma.$transaction(async (tx) => {
      if (body.isDefault === true && !existing.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: existing.id },
        data: {
          ...(body.addressType !== undefined && { addressType: body.addressType }),
          ...(body.label !== undefined && { label: optionalText(body.label) }),
          ...(body.recipientName !== undefined && { recipientName: optionalText(body.recipientName) }),
          ...(body.recipientPhone !== undefined && { recipientPhone: optionalText(body.recipientPhone) }),
          ...(body.addressLine1 !== undefined && { addressLine1: body.addressLine1.trim() }),
          ...(body.addressLine2 !== undefined && { addressLine2: optionalText(body.addressLine2) }),
          ...(body.landmark !== undefined && { landmark: optionalText(body.landmark) }),
          ...(body.city !== undefined && { city: body.city.trim() }),
          ...(body.state !== undefined && { state: body.state.trim() }),
          ...(body.postalCode !== undefined && { postalCode: body.postalCode.trim() }),
          ...(body.country !== undefined && { country: optionalText(body.country) ?? "India" }),
          ...(body.latitude !== undefined && { latitude: body.latitude }),
          ...(body.longitude !== undefined && { longitude: body.longitude }),
          ...(body.deliveryInstructions !== undefined && {
            deliveryInstructions: optionalText(body.deliveryInstructions),
          }),
          ...(body.isDefault === true && { isDefault: true }),
        },
        select: addressSelect,
      });
    });

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (error) {
    console.error("Update address error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

// Soft delete: past orders still reference the address.
export const deleteAddress = async (req: Request<AddressParams>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { addressId } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId, isActive: true, deletedAt: null },
      select: { id: true, isDefault: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.update({
        where: { id: existing.id },
        data: { isActive: false, isDefault: false, deletedAt: new Date() },
      });

      // Promote the most recent remaining address to default.
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId, isActive: true, deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (next) {
          await tx.address.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete address error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};
