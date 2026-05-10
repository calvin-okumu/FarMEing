/*
  Warnings:

  - You are about to drop the column `projectId` on the `Employee` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_projectId_fkey";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "projectId";

-- CreateTable
CREATE TABLE "EmployeeProject" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProject_employeeId_projectId_key" ON "EmployeeProject"("employeeId", "projectId");

-- AddForeignKey
ALTER TABLE "EmployeeProject" ADD CONSTRAINT "EmployeeProject_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProject" ADD CONSTRAINT "EmployeeProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FarmProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
