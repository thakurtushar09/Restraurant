import { prisma } from "../config/prisma";
import { publishNotifications, type NotificationAudience } from "./notification-hub";
import { sendPush } from "./push";
import { orderExpiryTime } from "./schedule-order-reminder";
import { orderUpdateEmail } from "../emails";
import { sendEmail, appUrl } from "./send-email";

export type OrderEvent =
  | "PLACED"
  | "ACCEPTED"
  | "REJECTED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED_BY_RESTAURANT"
  | "CANCELLED_BY_CUSTOMER"
  | "RESCHEDULED"
  | "EXPIRED"
  | "COOK_NOW"
  | "PREP_SOON"
  | "AUTO_ACCEPTED"
  | "AUTO_STARTED"
  | "DELAYED"
  | "ARRIVAL_REMINDER";

type Message = { title: string; body: string };
type StaffAudience = "kitchen" | "delivery";

const KITCHEN_ROLES = ["BRANCH_MANAGER", "KITCHEN_STAFF"] as const;
const DELIVERY_ROLES = ["BRANCH_MANAGER", "DELIVERY_STAFF"] as const;

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: { select: { itemName: true, variantName: true, quantity: true, lineTotal: true } },
      user: { select: { email: true, isEmailVerified: true } },
      branch: {
        select: {
          id: true,
          branchName: true,
          addressLine1: true,
          city: true,
          timezone: true,
          averagePreparationTimeMinutes: true,
          autoAcceptPreorders: true,
          restaurantGroupId: true,
          restaurantGroup: { select: { groupName: true } },
        },
      },
    },
  });
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

// "7:30 pm" when on the same day as `reference` (default: today) in the branch's timezone,
// otherwise "Fri, 13 Nov, 7:30 pm".
function formatTime(date: Date, timeZone: string, reference: Date = new Date()): string {
  const day = (value: Date) => new Intl.DateTimeFormat("en-IN", { timeZone, dateStyle: "short" }).format(value);
  const sameDay = day(date) === day(reference);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    ...(sameDay ? {} : { weekday: "short", day: "numeric", month: "short" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const shortNumber = (order: LoadedOrder) => `#${order.orderNumber.slice(-8)}`;
const money = (value: unknown) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const currencyAmount = (value: unknown, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(value));
const itemSummary = (order: LoadedOrder) => order.orderItems.map((item) => `${item.quantity}× ${item.itemName}`).join(", ");

function times(order: LoadedOrder) {
  const tz = order.branch.timezone;
  const prepMs = order.branch.averagePreparationTimeMinutes * 60 * 1000;
  const scheduled = order.scheduledAt;
  return {
    at: (date: Date) => formatTime(date, tz),
    scheduled: scheduled ? formatTime(scheduled, tz) : null,
    // Usually the same day as the arrival, so just the time reads better.
    cookStart: scheduled ? formatTime(new Date(scheduled.getTime() - prepMs), tz, scheduled) : null,
    // ASAP orders: ready about one prep-time from now.
    readyEstimate: formatTime(scheduled ?? new Date(Date.now() + prepMs), tz),
    expiry: formatTime(orderExpiryTime(scheduled, order.createdAt, order.branch.averagePreparationTimeMinutes), tz),
    // New ready time after the kitchen asked for more time.
    delayedUntil: order.delayedUntil ? formatTime(order.delayedUntil, tz) : null,
  };
}

export function customerMessage(event: OrderEvent, order: LoadedOrder): Message | null {
  // Automatic steps read the same to the guest as the kitchen doing them by hand.
  if (event === "AUTO_ACCEPTED") return customerMessage("ACCEPTED", order);
  if (event === "AUTO_STARTED") return customerMessage("PREPARING", order);

  const preorder = order.fulfillmentType === "DINE_IN";
  const group = order.branch.restaurantGroup.groupName;
  const place = `${group} · ${order.branch.branchName}`;
  const t = times(order);
  const table = order.partySize ? `table for ${order.partySize}` : "table";

  // Ordered by scanning the QR on a table: the guest is already seated.
  if (order.tableNumber) {
    switch (event) {
      case "PLACED": return { title: `Order sent to ${group}`, body: `Waiting for the kitchen to confirm your order for ${order.tableNumber}.` };
      case "ACCEPTED": return { title: "The kitchen is on it", body: `Your order is confirmed. It should reach ${order.tableNumber} around ${t.readyEstimate}.` };
      case "PREPARING": return { title: "Your food is being prepared", body: `Coming to ${order.tableNumber} around ${t.readyEstimate}.` };
      case "READY": return { title: "Your food is ready", body: `It's on its way to ${order.tableNumber}.` };
      case "COMPLETED": return { title: "Enjoy your meal", body: `Thanks for dining with ${group}. Pay at the counter when you're done.` };
      case "DELAYED": return { title: "Running a little late", body: `The kitchen needs about ${order.delayMinutes} more minutes. Your food should reach ${order.tableNumber} around ${t.delayedUntil}.` };
      default: break; // rejections, cancellations and expiry read the same as any order
    }
  }

  switch (event) {
    case "PLACED":
      return {
        title: `Order sent to ${group}`,
        body: preorder
          ? `Waiting for ${order.branch.branchName} to confirm your ${table} at ${t.scheduled}.`
          : `Waiting for ${order.branch.branchName} to confirm your delivery${t.scheduled ? ` for ${t.scheduled}` : ""}.`,
      };
    case "ACCEPTED":
      return {
        title: `Confirmed by ${group}`,
        body: preorder
          ? `Your ${table} is booked for ${t.scheduled}. The kitchen starts cooking at ${t.cookStart} so it's ready when you arrive.`
          : `Your order is confirmed. Estimated ready around ${t.readyEstimate}.`,
      };
    case "REJECTED":
      return { title: "Order declined", body: `${place} couldn't take your order${order.rejectionReason ? `: ${order.rejectionReason}` : "."}` };
    case "PREPARING":
      return {
        title: "Your food is being prepared",
        body: preorder ? `The kitchen is cooking for your ${t.scheduled} arrival.` : `Ready around ${t.readyEstimate}.`,
      };
    case "READY":
      return preorder
        ? { title: "Your table is ready", body: `Your food is ready at ${place}. Give your name at the door.` }
        : { title: "Your order is ready", body: "It's packed and waiting for a rider." };
    case "OUT_FOR_DELIVERY":
      return { title: "On the way", body: `Your order has left ${order.branch.branchName} and is heading to you.` };
    case "COMPLETED":
      return preorder
        ? { title: "Enjoy your meal", body: `Thanks for dining with ${group}.` }
        : { title: "Delivered", body: `Enjoy! Thanks for ordering from ${group}.` };
    case "CANCELLED_BY_RESTAURANT":
      return { title: "Order cancelled", body: `${place} cancelled your order${order.cancellationReason ? `: ${order.cancellationReason}` : "."}` };
    case "EXPIRED":
      return { title: "Not confirmed in time", body: `${order.branch.branchName} didn't confirm your order, so it was cancelled. You haven't been charged.` };
    case "DELAYED":
      return {
        title: "Running a little late",
        body: preorder
          ? `${place} is running about ${order.delayMinutes} minutes behind. Your food will be ready around ${t.delayedUntil}. Sorry for the wait.`
          : `${place} is running about ${order.delayMinutes} minutes behind. Your order is now expected around ${t.delayedUntil}.`,
      };
    case "ARRIVAL_REMINDER":
      return {
        title: `See you at ${t.scheduled}`,
        body: `Your ${table} at ${place}, ${order.branch.addressLine1}. The kitchen starts cooking at ${t.cookStart}.`,
      };
    default:
      return null;
  }
}

export function staffMessage(event: OrderEvent, order: LoadedOrder): (Message & { audience: StaffAudience }) | null {
  const preorder = order.fulfillmentType === "DINE_IN";
  const t = times(order);
  const who = order.customerName;
  const guests = order.partySize ? ` · ${order.partySize} guests` : "";

  if (order.tableNumber && event === "PLACED") {
    return {
      audience: "kitchen",
      title: `New order at ${order.tableNumber} ${shortNumber(order)}`,
      body: `${who}${guests} · seated now · ${itemSummary(order)} · ${money(order.totalAmount)}. Accept by ${t.expiry}.`,
    };
  }

  switch (event) {
    case "PLACED":
      return {
        audience: "kitchen",
        title: `New ${preorder ? "pre-order" : "delivery order"} ${shortNumber(order)}`,
        body: `${who}${guests} · ${preorder ? `arriving ${t.scheduled}` : t.scheduled ? `for ${t.scheduled}` : "as soon as possible"} · ${money(order.totalAmount)}. Accept by ${t.expiry}.`,
      };
    case "CANCELLED_BY_CUSTOMER":
      return { audience: "kitchen", title: `Cancelled by customer ${shortNumber(order)}`, body: `${who} cancelled their ${preorder ? `pre-order for ${t.scheduled}` : "order"}.` };
    case "RESCHEDULED":
      return { audience: "kitchen", title: `Time changed ${shortNumber(order)}`, body: `${who} now arrives at ${t.scheduled}. Start cooking at ${t.cookStart}.` };
    case "EXPIRED":
      return { audience: "kitchen", title: `Expired ${shortNumber(order)}`, body: `${who}'s order wasn't accepted in time and was cancelled automatically.` };
    case "AUTO_ACCEPTED":
      return {
        audience: "kitchen",
        title: `New ${preorder ? "pre-order" : "scheduled order"} ${shortNumber(order)} · auto-accepted`,
        body: `${who}${guests} · ${preorder ? `arriving ${t.scheduled}` : `for ${t.scheduled}`} · ${money(order.totalAmount)}. It moves to Cooking automatically at ${t.cookStart}.`,
      };
    case "PREP_SOON":
      if (order.orderStatus === "PENDING") {
        return { audience: "kitchen", title: `Not accepted yet ${shortNumber(order)}`, body: `${who} arrives at ${t.scheduled}. Accept it now — cooking should start at ${t.cookStart}.` };
      }
      return order.branch.autoAcceptPreorders
        ? { audience: "kitchen", title: `Cooking starts at ${t.cookStart} ${shortNumber(order)}`, body: `${who}${guests} arrives at ${t.scheduled}. It moves to Cooking automatically: ${itemSummary(order)}.` }
        : { audience: "kitchen", title: `Get ready: start at ${t.cookStart} ${shortNumber(order)}`, body: `${who}${guests} arrives at ${t.scheduled}. Move it to Cooking at ${t.cookStart}: ${itemSummary(order)}.` };
    case "AUTO_STARTED":
      return { audience: "kitchen", title: `Started cooking automatically ${shortNumber(order)}`, body: `${who}${guests} arrives at ${t.scheduled}: ${itemSummary(order)}.` };
    case "COOK_NOW":
      return order.orderStatus === "PENDING"
        ? { audience: "kitchen", title: `Still not accepted ${shortNumber(order)}`, body: `${who} arrives at ${t.scheduled} — accept and start cooking now or it will expire.` }
        : { audience: "kitchen", title: `Start cooking ${shortNumber(order)}`, body: `${who}${guests} arrives at ${t.scheduled}: ${itemSummary(order)}.` };
    case "READY":
      return preorder ? null : { audience: "delivery", title: `Ready for delivery ${shortNumber(order)}`, body: `${who} · ${order.deliveryAddressLine1 ?? ""}${order.deliveryCity ? `, ${order.deliveryCity}` : ""}.` };
    default:
      return null;
  }
}

// Moments worth an email as well as a push; the rest are too frequent for an inbox.
const EMAIL_EVENTS: OrderEvent[] = ["ACCEPTED", "AUTO_ACCEPTED", "REJECTED", "CANCELLED_BY_RESTAURANT", "EXPIRED"];

// Only to confirmed addresses, so we never email someone who mistyped theirs.
async function emailCustomer(event: OrderEvent, order: LoadedOrder, message: Message): Promise<void> {
  if (!EMAIL_EVENTS.includes(event) || !order.user.isEmailVerified) return;

  const preorder = order.fulfillmentType === "DINE_IN";
  await sendEmail(order.user.email, orderUpdateEmail({
    customerName: order.customerName,
    title: message.title,
    body: message.body,
    orderNumber: order.orderNumber.slice(-8),
    placeName: `${order.branch.restaurantGroup.groupName} · ${order.branch.branchName}`,
    when: order.scheduledAt ? formatTime(order.scheduledAt, order.branch.timezone) : null,
    whenLabel: preorder ? "Arrival" : "Delivery",
    items: order.orderItems.map((item) => ({
      quantity: item.quantity,
      name: item.variantName ? `${item.itemName} · ${item.variantName}` : item.itemName,
      lineTotal: currencyAmount(item.lineTotal, order.currency),
    })),
    total: currencyAmount(order.totalAmount, order.currency),
    orderUrl: appUrl("customer", `/orders/${order.id}`),
  }));
}

async function staffRecipients(order: LoadedOrder, audience: StaffAudience): Promise<string[]> {
  const roles = audience === "kitchen" ? KITCHEN_ROLES : DELIVERY_ROLES;
  const members = await prisma.restaurantMember.findMany({
    where: {
      restaurantGroupId: order.branch.restaurantGroupId,
      status: "ACTIVE",
      OR: [
        { role: { in: ["GROUP_OWNER", "GROUP_ADMIN"] }, branchId: null },
        { role: { in: [...roles] }, branchId: order.branch.id },
      ],
    },
    select: { userId: true },
  });
  return [...new Set(members.map((member) => member.userId))];
}

// Saves and pushes notifications for an order event. Never throws: a failed
// notification must not break the order flow that triggered it.
export async function notifyOrderEvent(orderId: string, event: OrderEvent): Promise<void> {
  try {
    const order = await loadOrder(orderId);
    if (!order) return;

    const rows: { userId: string; audience: NotificationAudience; type: string; title: string; body: string; orderId: string; branchId: string }[] = [];
    const base = { type: event, orderId: order.id, branchId: order.branch.id };

    const forCustomer = customerMessage(event, order);
    if (forCustomer) {
      rows.push({ ...base, ...forCustomer, userId: order.userId, audience: "CUSTOMER" });
      await emailCustomer(event, order, forCustomer);
    }

    const forStaff = staffMessage(event, order);
    if (forStaff) {
      for (const userId of await staffRecipients(order, forStaff.audience)) {
        rows.push({ ...base, title: forStaff.title, body: forStaff.body, userId, audience: "STAFF" });
      }
    }

    if (!rows.length) return;

    const saved = await prisma.notification.createManyAndReturn({ data: rows });
    await publishNotifications(saved.map((row) => ({ userId: row.userId, audience: row.audience, notification: row })));
    // Phones and closed tabs: same notification as a web push.
    await sendPush(saved);
  } catch (error) {
    console.error(`Failed to send ${event} notifications for order ${orderId}:`, error);
  }
}
