-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "auto_accept_preorders" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delay_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "delayed_until" TIMESTAMPTZ(6);
