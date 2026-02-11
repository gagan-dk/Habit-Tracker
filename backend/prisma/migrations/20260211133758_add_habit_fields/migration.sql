/*
  Warnings:

  - Added the required column `startDate` to the `Habit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "category" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;
