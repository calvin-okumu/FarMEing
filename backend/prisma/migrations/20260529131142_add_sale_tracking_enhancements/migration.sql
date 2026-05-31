-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "blockId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "invoiceUrl" TEXT;

-- AlterTable
ALTER TABLE "SalePayment" ADD COLUMN     "method" TEXT DEFAULT 'CASH';

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
