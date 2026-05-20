/*
  Warnings:

  - You are about to drop the column `callOfferPrice` on the `PricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `callOfferType` on the `PricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `chatOfferPrice` on the `PricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `chatOfferType` on the `PricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `PricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `isFirstFreeEnabled` on the `PricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `hasUsedFirstOffer` on the `UserOfferUsage` table. All the data in the column will be lost.
  - You are about to drop the column `usedAt` on the `UserOfferUsage` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `UserOfferUsage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PricingConfig" DROP COLUMN "callOfferPrice",
DROP COLUMN "callOfferType",
DROP COLUMN "chatOfferPrice",
DROP COLUMN "chatOfferType",
DROP COLUMN "createdAt",
DROP COLUMN "isFirstFreeEnabled",
DROP COLUMN "updatedAt",
ADD COLUMN     "firstCallPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firstChatPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isFirstOfferEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isSecondOfferEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secondCallPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "secondChatPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserOfferUsage" DROP COLUMN "hasUsedFirstOffer",
DROP COLUMN "usedAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usedFirst" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usedSecond" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visitCount" INTEGER NOT NULL DEFAULT 0;
