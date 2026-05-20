/*
  Warnings:

  - You are about to drop the column `interviewScheduledAt` on the `AstrologerApplication` table. All the data in the column will be lost.
  - You are about to drop the column `interviewTakenAt` on the `AstrologerApplication` table. All the data in the column will be lost.
  - You are about to drop the `BankDetails` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `address` to the `AstrologerApplication` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BankDetails" DROP CONSTRAINT "BankDetails_astrologerId_fkey";

-- AlterTable
ALTER TABLE "Astrologer" ADD COLUMN     "kycDetailId" TEXT;

-- AlterTable
ALTER TABLE "AstrologerApplication" DROP COLUMN "interviewScheduledAt",
DROP COLUMN "interviewTakenAt",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "pincode" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- DropTable
DROP TABLE "BankDetails";

-- CreateTable
CREATE TABLE "KycDetail" (
    "id" TEXT NOT NULL,
    "astrologerApplicationId" TEXT NOT NULL,
    "accountHolderName" TEXT,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "ifsc" TEXT,
    "branchName" TEXT,
    "panNumber" TEXT,
    "profileImage" TEXT,
    "aadhaarImage" TEXT,
    "panImage" TEXT,
    "passbookImage" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycDetail_astrologerApplicationId_key" ON "KycDetail"("astrologerApplicationId");

-- AddForeignKey
ALTER TABLE "Astrologer" ADD CONSTRAINT "Astrologer_kycDetailId_fkey" FOREIGN KEY ("kycDetailId") REFERENCES "KycDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDetail" ADD CONSTRAINT "KycDetail_astrologerApplicationId_fkey" FOREIGN KEY ("astrologerApplicationId") REFERENCES "AstrologerApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
