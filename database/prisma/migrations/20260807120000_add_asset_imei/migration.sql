-- Add IMEI tracking for technology devices.
-- IMEI is captured on the inventory item (when registering phones / tablets)
-- and copied onto the Asset record when delivered via the tech-device
-- delivery certificate.

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "imei" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "serialNumber" TEXT;

ALTER TABLE "Asset" ADD COLUMN "imei" TEXT;