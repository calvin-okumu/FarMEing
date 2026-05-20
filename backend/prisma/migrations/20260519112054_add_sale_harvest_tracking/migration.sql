-- AlterTable
ALTER TABLE "Harvest" ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "rejectedWeight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SaleHarvest" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "harvestId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleHarvest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleHarvest_saleId_harvestId_key" ON "SaleHarvest"("saleId", "harvestId");

-- AddForeignKey
ALTER TABLE "SaleHarvest" ADD CONSTRAINT "SaleHarvest_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleHarvest" ADD CONSTRAINT "SaleHarvest_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
