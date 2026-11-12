
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { CheckoutRequestBody } from "../types/order.types";
import {scheduleOrderReminder,scheduleOrderExpiry,scheduleArrivalReminder,orderExpiryTime,isValidScheduleTime,MAX_SCHEDULE_DAYS,} from "../utils/schedule-order-reminder";
import { notifyOrderEvent } from "../utils/notify";
import { isOpenAt } from "../utils/opening-hours";

export const checkout = async (
  req: Request<{}, {}, CheckoutRequestBody>,
  res: Response
): Promise<void> => {
  try {
    const userId = res.locals.userId as string | undefined;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Please log in before checkout",
      });
      return;
    }

    const {
      branchId,
      fulfillmentType,
      paymentMethod,
      addressId,
      customerName,
      customerPhone,
      customerNotes,
      needsPackaging,
      scheduledAt,
      partySize,
      items,
    } = req.body;

    if (
      !branchId ||
      !customerName?.trim() ||
      !customerPhone?.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      res.status(400).json({
        success: false,
        message: "Branch, customer details, and cart items are required",
      });
      return;
    }

    // Pickup is switched off for now; DINE_IN is the "pre-order and eat at the restaurant" flow.
    if (!["DELIVERY", "DINE_IN"].includes(fulfillmentType)) {
      res.status(400).json({
        success: false,
        message: fulfillmentType === "PICKUP" ? "Pickup is not available right now" : "Invalid fulfillment type",
      });
      return;
    }

    if (fulfillmentType === "DINE_IN" && (!Number.isInteger(partySize) || partySize! < 1 || partySize! > 20)) {
      res.status(400).json({
        success: false,
        message: "Tell us how many guests are coming (1–20)",
      });
      return;
    }

    if (fulfillmentType === "DINE_IN" && !scheduledAt) {
      res.status(400).json({
        success: false,
        message: "Choose when you'll arrive for your pre-order",
      });
      return;
    }

    if (
      paymentMethod !== undefined &&
      !["ONLINE", "CASH", "PAY_AT_COUNTER"].includes(paymentMethod)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
      return;
    }

    if (fulfillmentType === "DELIVERY" && !addressId) {
      res.status(400).json({
        success: false,
        message: "A delivery address is required",
      });
      return;
    }

    for (const item of items) {
      if (
        !item.menuItemId ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        res.status(400).json({
          success: false,
          message: "Each item needs a valid ID and quantity between 1 and 99",
        });
        return;
      }
    }

    let requestedSchedule: Date | undefined;

    if (scheduledAt !== undefined) {
      requestedSchedule = new Date(scheduledAt);

      if (!isValidScheduleTime(requestedSchedule)) {
        res.status(400).json({
          success: false,
          message: `Scheduled time must be a valid date within the next ${MAX_SCHEDULE_DAYS} days`,
        });
        return;
      }
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: userId,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        const branch = await tx.branch.findFirst({
          where: {
            id: branchId,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: {
            id: true,
            currency: true,
            acceptsDelivery: true,
            acceptsDineIn: true,
            averagePreparationTimeMinutes: true,
            openingHours: true,
            timezone: true,
          },
        });

        if (!branch) {
          throw new Error("BRANCH_UNAVAILABLE");
        }

        if (
          (fulfillmentType === "DELIVERY" && !branch.acceptsDelivery) ||
          (fulfillmentType === "DINE_IN" && !branch.acceptsDineIn)
        ) {
          throw new Error("FULFILLMENT_UNAVAILABLE");
        }

        // The kitchen needs at least its prep time, and the branch must be open at that moment.
        if (requestedSchedule) {
          const earliest = Date.now() + branch.averagePreparationTimeMinutes * 60 * 1000;
          if (requestedSchedule.getTime() < earliest) throw new Error("SCHEDULE_TOO_SOON");
          if (!isOpenAt(branch.openingHours, branch.timezone, requestedSchedule)) throw new Error("CLOSED_AT_SCHEDULE");
        } else if (!isOpenAt(branch.openingHours, branch.timezone, new Date())) {
          throw new Error("CLOSED_NOW");
        }

        let deliveryAddress: {
          addressLine1: string;
          addressLine2: string | null;
          landmark: string | null;
          city: string;
          state: string;
          postalCode: string;
          latitude: Prisma.Decimal | null;
          longitude: Prisma.Decimal | null;
        } | null = null;

        if (fulfillmentType === "DELIVERY") {
          const address = await tx.address.findFirst({
            where: {
              id: addressId!,
              userId,
              isActive: true,
              deletedAt: null,
            },
          });

          if (!address) {
            throw new Error("ADDRESS_NOT_FOUND");
          }

          deliveryAddress = {
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            latitude: address.latitude,
            longitude: address.longitude,
          };
        }

        const menuItemIds = [
          ...new Set(items.map((item) => item.menuItemId)),
        ];

        const menuItems = await tx.menuItem.findMany({
          where: {
            id: { in: menuItemIds },
            branchId,
            status: "ACTIVE",
            isAvailable: true,
            deletedAt: null,
            category: { isActive: true },
          },
          include: {
            variants: {
              where: { isAvailable: true },
            },
          },
        });

        const itemMap = new Map(
          menuItems.map((item) => [item.id, item])
        );

        let subtotalCents = 0;

        const orderItems = items.map((requestedItem) => {
          const menuItem = itemMap.get(requestedItem.menuItemId);

          if (!menuItem) {
            throw new Error("MENU_ITEM_UNAVAILABLE");
          }

          let unitPrice: number;
          let variantName: string | null = null;
          let variantId: string | null = null;

          if (menuItem.variants.length > 0) {
            if (!requestedItem.variantId) {
              throw new Error("VARIANT_REQUIRED");
            }

            const variant = menuItem.variants.find(
              (candidate) => candidate.id === requestedItem.variantId
            );

            if (!variant) {
              throw new Error("VARIANT_UNAVAILABLE");
            }

            unitPrice = Number(variant.price);
            variantName = variant.name;
            variantId = variant.id;
          } else {
            if (requestedItem.variantId) {
              throw new Error("VARIANT_NOT_APPLICABLE");
            }

            unitPrice = Number(menuItem.basePrice);
          }

          const unitPriceCents = Math.round(unitPrice * 100);
          const lineTotalCents = unitPriceCents * requestedItem.quantity;

          subtotalCents += lineTotalCents;

          return {
            menuItemId: menuItem.id,
            variantId,
            itemName: menuItem.name,
            variantName,
            unitPrice: (unitPriceCents / 100).toFixed(2),
            quantity: requestedItem.quantity,
            lineTotal: (lineTotalCents / 100).toFixed(2),
            specialInstructions:
              requestedItem.specialInstructions?.trim() || null,
          };
        });

        const subtotal = (subtotalCents / 100).toFixed(2);
        const zeroAmount = "0.00";
        const orderNumber =
          `ORD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            branchId,
            addressId:
              fulfillmentType === "DELIVERY" ? addressId! : null,
            fulfillmentType,
            paymentMethod: paymentMethod ?? (fulfillmentType === "DINE_IN" ? "PAY_AT_COUNTER" : "CASH"),
            paymentStatus: "UNPAID",
            needsPackaging: needsPackaging ?? false,
            currency: branch.currency,
            subtotal,
            discountAmount: zeroAmount,
            taxAmount: zeroAmount,
            deliveryFee: zeroAmount,
            totalAmount: subtotal,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerNotes: customerNotes?.trim() || null,
            ...(deliveryAddress && {
              deliveryAddressLine1: deliveryAddress.addressLine1,
              deliveryAddressLine2: deliveryAddress.addressLine2,
              deliveryLandmark: deliveryAddress.landmark,
              deliveryCity: deliveryAddress.city,
              deliveryState: deliveryAddress.state,
              deliveryPostalCode: deliveryAddress.postalCode,
              deliveryLatitude: deliveryAddress.latitude,
              deliveryLongitude: deliveryAddress.longitude,
            }),
            scheduledAt: requestedSchedule ?? null,
            partySize: fulfillmentType === "DINE_IN" ? partySize! : null,
            orderItems: {
              create: orderItems,
            },
          },
          include: {
            orderItems: true,
          },
        });

        return {
          order,
          preparationMinutes: branch.averagePreparationTimeMinutes,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    // Queue failures shouldn't undo a placed order; they're logged instead.
    try {
      if (result.order.scheduledAt) {
        await scheduleOrderReminder(result.order.id, result.order.scheduledAt, result.preparationMinutes);
        if (result.order.fulfillmentType === "DINE_IN") await scheduleArrivalReminder(result.order.id, result.order.scheduledAt);
      }
      await scheduleOrderExpiry(
        result.order.id,
        orderExpiryTime(result.order.scheduledAt, result.order.createdAt, result.preparationMinutes)
      );
    } catch (error) {
      console.error("Failed to schedule order jobs:", error);
    }

    // Tell the guest it was sent and the kitchen it arrived; runs in the background.
    void notifyOrderEvent(result.order.id, "PLACED");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: result.order,
    });
  } catch (error) {
    const errors: Record<string, { status: number; message: string }> = {
      USER_NOT_FOUND: {
        status: 401,
        message: "User account is inactive or no longer exists",
      },
      BRANCH_UNAVAILABLE: {
        status: 404,
        message: "Branch not found or unavailable",
      },
      FULFILLMENT_UNAVAILABLE: {
        status: 400,
        message: "This fulfillment option is not available at this branch",
      },
      ADDRESS_NOT_FOUND: {
        status: 400,
        message: "Delivery address not found or inactive",
      },
      MENU_ITEM_UNAVAILABLE: {
        status: 400,
        message: "One or more menu items are unavailable",
      },
      VARIANT_REQUIRED: {
        status: 400,
        message: "Select a variant for each item that has variants",
      },
      VARIANT_UNAVAILABLE: {
        status: 400,
        message: "Selected variant is unavailable",
      },
      SCHEDULE_TOO_SOON: {
        status: 400,
        message: "That time is too soon for the kitchen. Please choose a later time.",
      },
      CLOSED_AT_SCHEDULE: {
        status: 400,
        message: "The restaurant is closed at that time. Please choose a time within opening hours.",
      },
      CLOSED_NOW: {
        status: 400,
        message: "The restaurant is closed right now. Schedule your order for when it opens.",
      },
      VARIANT_NOT_APPLICABLE: {
        status: 400,
        message: "This item does not have selectable variants",
      },
    };

    if (error instanceof Error && errors[error.message]) {
      const knownError = errors[error.message];

      res.status(knownError.status).json({
        success: false,
        message: knownError.message,
      });
      return;
    }

    console.error("Checkout error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};
