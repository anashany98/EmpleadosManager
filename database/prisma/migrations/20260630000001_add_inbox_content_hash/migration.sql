-- MED-004: añadir `contentHash` (SHA-256 del contenido) a
-- `InboxDocument` para deduplicar por contenido. La unicidad se
-- delega al índice único, de forma que dos workers concurrentes
-- que reciben el mismo archivo terminan con uno creando la fila
-- y el otro recibiendo un P2002 que descartamos limpiamente.
ALTER TABLE "InboxDocument" ADD COLUMN "contentHash" TEXT;
CREATE UNIQUE INDEX "InboxDocument_contentHash_key" ON "InboxDocument"("contentHash");
