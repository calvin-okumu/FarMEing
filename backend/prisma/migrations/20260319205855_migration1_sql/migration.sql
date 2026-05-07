-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "expenseType" TEXT NOT NULL DEFAULT 'OPEX',
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FarmProject" ADD COLUMN     "expectedYield" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "WorkEntry" ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "hoursWorked" DOUBLE PRECISION,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Harvest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "quality" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customer" TEXT,
    "weightSold" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FarmProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FarmProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
