-- DropForeignKey
ALTER TABLE "KycDetail" DROP CONSTRAINT "KycDetail_astrologerApplicationId_fkey";

-- AlterTable
ALTER TABLE "KycDetail" ALTER COLUMN "astrologerApplicationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "KycDetail" ADD CONSTRAINT "KycDetail_astrologerApplicationId_fkey" FOREIGN KEY ("astrologerApplicationId") REFERENCES "AstrologerApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
