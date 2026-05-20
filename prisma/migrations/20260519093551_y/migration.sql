/*
  Warnings:

  - You are about to drop the column `aboutEnglish` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the column `approvalStatus` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Astrologer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[astrologerId]` on the table `KycDetail` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `about` to the `Astrologer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirth` to the `Astrologer` table without a default value. This is not possible if the table is not empty.
  - Made the column `profilePic` on table `Astrologer` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `astrologerId` to the `KycDetail` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Astrologer" DROP CONSTRAINT "Astrologer_kycDetailId_fkey";

-- DropIndex
DROP INDEX "User_mobile_key";

-- AlterTable
ALTER TABLE "Astrologer" DROP COLUMN "aboutEnglish",
DROP COLUMN "approvalStatus",
DROP COLUMN "password",
ADD COLUMN     "about" TEXT NOT NULL,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "rating" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "status" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "profilePic" SET NOT NULL;

-- AlterTable
ALTER TABLE "AstrologerApplication" ADD COLUMN     "problems" TEXT[];

-- AlterTable
ALTER TABLE "KycDetail" ADD COLUMN     "astrologerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Astrologer_rating_idx" ON "Astrologer"("rating");

-- CreateIndex
CREATE INDEX "Astrologer_experience_idx" ON "Astrologer"("experience");

-- CreateIndex
CREATE UNIQUE INDEX "KycDetail_astrologerId_key" ON "KycDetail"("astrologerId");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- AddForeignKey
ALTER TABLE "KycDetail" ADD CONSTRAINT "KycDetail_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
