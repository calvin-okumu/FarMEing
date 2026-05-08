-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "projectId" TEXT;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FarmProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FarmProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
