import type { BranchFields, OpeningHours } from "../types/restaurant.types";

export class InputError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9\s-]{6,18}$/;
const POSTAL_CODE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/;
const CURRENCY = /^[A-Z]{3}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL = /^https?:\/\/\S+$/i;

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const EDITABLE_BRANCH_STATUSES = ["ACTIVE", "INACTIVE", "TEMPORARILY_CLOSED"] as const;

export const patterns = { EMAIL, PHONE, URL };

type TextOptions = {
  required?: boolean;
  max?: number;
  pattern?: RegExp;
  message?: string;
};

// Reads request fields. In "create" mode required fields must be present;
// in "update" mode missing fields are skipped but provided ones are still checked.
export class InputReader {
  private input: Record<string, unknown>;

  constructor(body: unknown, private mode: "create" | "update") {
    this.input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  }

  has(key: string): boolean {
    return this.input[key] !== undefined;
  }

  text(key: string, label: string, options: TextOptions = {}): string | null | undefined {
    const value = this.input[key];

    if (value === undefined) {
      if (options.required && this.mode === "create") throw new InputError(`${label} is required`);
      return undefined;
    }

    if (value === null || (typeof value === "string" && !value.trim())) {
      if (options.required) throw new InputError(`${label} is required`);
      return null;
    }

    if (typeof value !== "string") throw new InputError(`${label} must be text`);

    const trimmed = value.trim();
    const max = options.max ?? 200;

    if (trimmed.length > max) throw new InputError(`${label} must be ${max} characters or fewer`);
    if (options.pattern && !options.pattern.test(trimmed)) throw new InputError(options.message ?? `${label} is invalid`);

    return trimmed;
  }

  integer(key: string, label: string, min: number, max: number): number | undefined {
    const value = this.input[key];
    if (value === undefined) return undefined;

    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new InputError(`${label} must be a whole number between ${min} and ${max}`);
    }

    return value;
  }

  boolean(key: string, label: string): boolean | undefined {
    const value = this.input[key];
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") throw new InputError(`${label} must be true or false`);
    return value;
  }

  coordinate(key: string, label: string, limit: number): number | null | undefined {
    const value = this.input[key];
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;

    if (typeof value !== "number" || !Number.isFinite(value) || value < -limit || value > limit) {
      throw new InputError(`${label} must be a number between -${limit} and ${limit}`);
    }

    return value;
  }

  raw(key: string): unknown {
    return this.input[key];
  }
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// Format: { mon: { closed: false, open: "09:00", close: "22:00" }, ... } for all seven days.
function parseOpeningHours(value: unknown): OpeningHours {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InputError("Opening hours must list every day of the week");
  }

  const source = value as Record<string, unknown>;
  const hours = {} as OpeningHours;

  for (const day of WEEK_DAYS) {
    const entry = source[day] as { closed?: unknown; open?: unknown; close?: unknown } | undefined;

    if (!entry || typeof entry !== "object") {
      throw new InputError(`Opening hours are missing for ${day}`);
    }

    if (entry.closed === true) {
      hours[day] = { closed: true };
      continue;
    }

    if (typeof entry.open !== "string" || typeof entry.close !== "string" || !TIME.test(entry.open) || !TIME.test(entry.close)) {
      throw new InputError(`Opening hours for ${day} need open and close times as HH:MM`);
    }

    // Closing after midnight (e.g. 18:00–02:00) is allowed; identical times are not.
    if (entry.open === entry.close) {
      throw new InputError(`Opening and closing times for ${day} cannot be the same`);
    }

    hours[day] = { closed: false, open: entry.open, close: entry.close };
  }

  if (WEEK_DAYS.every((day) => hours[day].closed)) {
    throw new InputError("The branch must be open on at least one day");
  }

  return hours;
}

export function parseBranchFields(body: unknown, mode: "create" | "update"): BranchFields {
  const reader = new InputReader(body, mode);
  const fields: BranchFields = {};
  const assign = <K extends keyof BranchFields>(key: K, value: BranchFields[K] | undefined) => {
    if (value !== undefined) fields[key] = value;
  };

  assign("branchName", reader.text("branchName", "Branch name", { required: true, max: 100 }) as string | undefined);
  assign("phone", reader.text("phone", "Branch phone", { pattern: PHONE, message: "Branch phone must be a valid phone number" }));
  assign("email", reader.text("email", "Branch email", { pattern: EMAIL, message: "Branch email must be a valid email address" }));
  assign("addressLine1", reader.text("addressLine1", "Address line 1", { required: true }) as string | undefined);
  assign("addressLine2", reader.text("addressLine2", "Address line 2"));
  assign("landmark", reader.text("landmark", "Landmark"));
  assign("city", reader.text("city", "City", { required: true, max: 100 }) as string | undefined);
  assign("state", reader.text("state", "State", { required: true, max: 100 }) as string | undefined);
  assign("postalCode", reader.text("postalCode", "Postal code", { required: true, pattern: POSTAL_CODE, message: "Postal code is invalid" }) as string | undefined);
  assign("country", (reader.text("country", "Country", { max: 100 }) ?? (mode === "create" ? "India" : undefined)) as string | undefined);

  const timezone = reader.text("timezone", "Timezone", { max: 64 });
  if (timezone && !isValidTimezone(timezone)) throw new InputError("Timezone is not recognised");
  assign("timezone", timezone ?? (mode === "create" ? "Asia/Kolkata" : undefined));

  const currency = reader.text("currency", "Currency", { max: 3 })?.toUpperCase();
  if (currency && !CURRENCY.test(currency)) throw new InputError("Currency must be a 3-letter code like INR");
  assign("currency", currency ?? (mode === "create" ? "INR" : undefined));

  assign("averagePreparationTimeMinutes", reader.integer("averagePreparationTimeMinutes", "Average preparation time", 1, 240) ?? (mode === "create" ? 30 : undefined));
  assign("acceptsDelivery", reader.boolean("acceptsDelivery", "Delivery") ?? (mode === "create" ? true : undefined));
  // Pickup is switched off for now; dine-in carries pre-orders.
  assign("acceptsPickup", reader.boolean("acceptsPickup", "Pickup") ?? (mode === "create" ? false : undefined));
  assign("acceptsDineIn", reader.boolean("acceptsDineIn", "Pre-orders") ?? (mode === "create" ? true : undefined));

  const latitude = reader.coordinate("latitude", "Latitude", 90);
  const longitude = reader.coordinate("longitude", "Longitude", 180);
  const bothChecked = mode === "create" || (latitude !== undefined && longitude !== undefined);
  if (bothChecked && (typeof latitude === "number") !== (typeof longitude === "number")) {
    throw new InputError("Provide both latitude and longitude, or neither");
  }
  assign("latitude", latitude);
  assign("longitude", longitude);

  if (reader.has("openingHours")) {
    assign("openingHours", parseOpeningHours(reader.raw("openingHours")));
  } else if (mode === "create") {
    throw new InputError("Opening hours are required");
  }

  if (mode === "update" && reader.has("status")) {
    const status = reader.raw("status");
    if (!EDITABLE_BRANCH_STATUSES.includes(status as (typeof EDITABLE_BRANCH_STATUSES)[number])) {
      throw new InputError(`Status must be one of ${EDITABLE_BRANCH_STATUSES.join(", ")}`);
    }
    fields.status = status as BranchFields["status"];
  }

  return fields;
}

// Run after merging with existing values on update.
export function assertFulfillment(fields: { acceptsDelivery?: boolean; acceptsDineIn?: boolean }): void {
  if (!fields.acceptsDelivery && !fields.acceptsDineIn) {
    throw new InputError("Enable delivery, pre-orders, or both");
  }
}
