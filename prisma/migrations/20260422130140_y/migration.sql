/*
  Warnings:

  - The `skills` column on the `NewAstrologer` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "NewAstrologer" DROP COLUMN "skills",
ADD COLUMN     "skills" TEXT[];

-- CreateTable
CREATE TABLE "AstrologerApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "languages" TEXT[],
    "skills" TEXT[],
    "experience" INTEGER NOT NULL,
    "about" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AstrologerApplication_pkey" PRIMARY KEY ("id")
);
