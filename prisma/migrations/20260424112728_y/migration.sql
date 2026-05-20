-- AlterTable
ALTER TABLE "AstrologerApplication" ADD COLUMN     "interviewRemarks" TEXT,
ADD COLUMN     "interviewScheduledAt" TIMESTAMP(3),
ADD COLUMN     "interviewTakenAt" TIMESTAMP(3);
