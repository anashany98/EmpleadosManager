-- CreateTable ObraContractor (autónomos que trabajan en obras, NO empleados)
CREATE TABLE "ObraContractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "vatRate" DECIMAL(5,2),
    "irpfRate" DECIMAL(5,2),
    "iban" TEXT,
    "activity" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObraContractor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObraContractor_nif_key" ON "ObraContractor"("nif");
CREATE INDEX "ObraContractor_active_idx" ON "ObraContractor"("active");
CREATE INDEX "ObraContractor_name_idx" ON "ObraContractor"("name");

-- Vincular gastos de obra a un autónomo (opcional; si el autónomo se borra, el gasto se conserva)
ALTER TABLE "ObraExpense" ADD COLUMN "contractorId" TEXT;

CREATE INDEX "ObraExpense_contractorId_idx" ON "ObraExpense"("contractorId");

ALTER TABLE "ObraExpense" ADD CONSTRAINT "ObraExpense_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "ObraContractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
