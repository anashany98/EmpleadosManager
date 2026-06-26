-- Add imageUrl field to InventoryItem for product photos
ALTER TABLE "InventoryItem" ADD COLUMN "imageUrl" TEXT;

-- Create index for faster inventory image lookups
CREATE INDEX IF NOT EXISTS "InventoryItem_imageUrl_idx" ON "InventoryItem"("imageUrl");
