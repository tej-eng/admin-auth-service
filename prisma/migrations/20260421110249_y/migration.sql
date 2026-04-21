/*
  Warnings:

  - You are about to drop the column `audiocall_charges` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the column `audiovideocall_offer_charges` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the column `callChatCharges` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the column `callChatCommission` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the column `callChatOfferCharges` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the column `videocall_charges` on the `Astrologer` table. All the data in the column will be lost.
  - You are about to drop the `CommissionConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('CHAT', 'CALL', 'VIDEO', 'AUDIO');

-- AlterTable
ALTER TABLE "Astrologer" DROP COLUMN "audiocall_charges",
DROP COLUMN "audiovideocall_offer_charges",
DROP COLUMN "callChatCharges",
DROP COLUMN "callChatCommission",
DROP COLUMN "callChatOfferCharges",
DROP COLUMN "videocall_charges",
ADD COLUMN     "astrologerCommissionId" TEXT;

-- DropTable
DROP TABLE "CommissionConfig";

-- CreateTable
CREATE TABLE "AstrologerPricing" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "type" "PricingType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "offerPrice" DOUBLE PRECISION,
    "commissionPercent" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AstrologerPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerPricing_astrologerId_type_key" ON "AstrologerPricing"("astrologerId", "type");

-- AddForeignKey
ALTER TABLE "AstrologerPricing" ADD CONSTRAINT "AstrologerPricing_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
