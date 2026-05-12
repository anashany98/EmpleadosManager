-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "annualTotalSalary" DECIMAL(65,30) DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN "monthlyTotalSalary" DECIMAL(65,30) DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN "companyShortPhone" TEXT;
