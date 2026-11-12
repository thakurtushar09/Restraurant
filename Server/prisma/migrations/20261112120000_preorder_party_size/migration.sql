-- Pre-orders replace pickup: new branches take pre-orders by default.
ALTER TABLE "branches" ALTER COLUMN "accepts_pickup" SET DEFAULT false,
ALTER COLUMN "accepts_dine_in" SET DEFAULT true;

-- Branches that only offered pickup would disappear from the customer site, so move them to pre-orders.
UPDATE "branches" SET "accepts_dine_in" = true
WHERE "accepts_dine_in" = false AND "accepts_delivery" = false;

UPDATE "branches" SET "accepts_pickup" = false WHERE "accepts_pickup" = true;

-- Guests expected for a pre-order (null for delivery).
ALTER TABLE "orders" ADD COLUMN "party_size" INTEGER;
