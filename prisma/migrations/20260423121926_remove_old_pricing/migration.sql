/*
  Warnings:

  - You are about to drop the column `status` on the `AstrologerApplication` table. All the data in the column will be lost.
  - You are about to drop the `NewAstrologer` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phoneNumber]` on the table `AstrologerApplication` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `AstrologerApplication` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `AstrologerApplication` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `gender` on the `AstrologerApplication` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('FREE', 'ONE_RUPEE', 'ORIGINAL');

-- DropForeignKey
ALTER TABLE "NewAstrologer" DROP CONSTRAINT "NewAstrologer_interviewerId_fkey";

-- DropForeignKey
ALTER TABLE "NewAstrologer" DROP CONSTRAINT "NewAstrologer_staffId_fkey";

-- AlterTable
ALTER TABLE "AstrologerApplication" DROP COLUMN "status",
ADD COLUMN     "applicationStatus" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "astrologerId" TEXT,
ADD COLUMN     "documentStatus" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "interviewDate" TIMESTAMP(3),
ADD COLUMN     "interviewStatus" "InterviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "interviewTime" TEXT,
ADD COLUMN     "interviewerId" TEXT,
ADD COLUMN     "round" INTEGER,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender" NOT NULL;

-- DropTable
DROP TABLE "NewAstrologer";

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "isFirstFreeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatOfferType" "OfferType" NOT NULL DEFAULT 'FREE',
    "callOfferType" "OfferType" NOT NULL DEFAULT 'FREE',
    "chatOfferPrice" DOUBLE PRECISION,
    "callOfferPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOfferUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasUsedFirstOffer" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOfferUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOfferUsage_userId_key" ON "UserOfferUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerApplication_phoneNumber_key" ON "AstrologerApplication"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerApplication_email_key" ON "AstrologerApplication"("email");

-- CreateIndex
CREATE INDEX "AstrologerApplication_applicationStatus_idx" ON "AstrologerApplication"("applicationStatus");

-- CreateIndex
CREATE INDEX "AstrologerApplication_interviewStatus_idx" ON "AstrologerApplication"("interviewStatus");

-- CreateIndex
CREATE INDEX "AstrologerApplication_approvalStatus_idx" ON "AstrologerApplication"("approvalStatus");

-- AddForeignKey
ALTER TABLE "AstrologerApplication" ADD CONSTRAINT "AstrologerApplication_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerApplication" ADD CONSTRAINT "AstrologerApplication_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerApplication" ADD CONSTRAINT "AstrologerApplication_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
