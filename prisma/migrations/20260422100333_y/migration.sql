/*
  Warnings:

  - You are about to drop the column `interviewer` on the `NewAstrologer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NewAstrologer" DROP COLUMN "interviewer",
ADD COLUMN     "interviewerId" TEXT,
ADD COLUMN     "staffId" TEXT;

-- AddForeignKey
ALTER TABLE "NewAstrologer" ADD CONSTRAINT "NewAstrologer_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewAstrologer" ADD CONSTRAINT "NewAstrologer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
