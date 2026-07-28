-- Align the deployed InventoryItem table with fields already used by Prisma.
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "entryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "type" TEXT,
  ADD COLUMN IF NOT EXISTS "brand" TEXT,
  ADD COLUMN IF NOT EXISTS "sku" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier" TEXT,
  ADD COLUMN IF NOT EXISTS "warehouseLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
