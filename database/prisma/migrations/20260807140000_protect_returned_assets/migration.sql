-- Cambia la relacion Asset.inventoryItemId de Cascade a Restrict.
-- Asi, borrar un InventoryItem queda bloqueado por cualquier
-- Asset vinculado (asignado o devuelto) y los registros
-- historicos no se pierden al retirar el producto del catalogo.

-- AlterForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_inventoryItemId_fkey";
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;