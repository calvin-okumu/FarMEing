-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN     "blockId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "blockId" TEXT;

-- AlterTable
ALTER TABLE "FarmProject" ADD COLUMN     "cropVariety" TEXT;

-- AlterTable
ALTER TABLE "Harvest" ADD COLUMN     "blockId" TEXT;

-- AlterTable
ALTER TABLE "ProjectAccess" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "balanceDue" DOUBLE PRECISION,
ADD COLUMN     "paymentStatus" TEXT,
ADD COLUMN     "receiptUrl" TEXT;

-- AlterTable
ALTER TABLE "WorkEntry" ADD COLUMN     "blockId" TEXT;

-- CreateTable
CREATE TABLE "ProjectInvitation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBlock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "landSize" DOUBLE PRECISION,
    "landUnit" TEXT,
    "crop" TEXT,
    "cropVariety" TEXT,
    "expectedYield" DOUBLE PRECISION,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "syncStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvitation_inviteCode_key" ON "ProjectInvitation"("inviteCode");

-- AddForeignKey
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FarmProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBlock" ADD CONSTRAINT "ProjectBlock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FarmProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
