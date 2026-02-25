/*
  Warnings:

  - A unique constraint covering the columns `[astrologerId,documentType]` on the table `AstrologerDocument` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[astrologerId,roundNumber]` on the table `Interview` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Astrologer" ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "rating" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "RechargePack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "coins" INTEGER NOT NULL,
    "talktime" INTEGER NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RechargePack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_astrologerId_idx" ON "Address"("astrologerId");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- CreateIndex
CREATE INDEX "Address_pincode_idx" ON "Address"("pincode");

-- CreateIndex
CREATE INDEX "Admin_roleId_idx" ON "Admin"("roleId");

-- CreateIndex
CREATE INDEX "Admin_isActive_idx" ON "Admin"("isActive");

-- CreateIndex
CREATE INDEX "Admin_isDeleted_idx" ON "Admin"("isDeleted");

-- CreateIndex
CREATE INDEX "Astrologer_approvalStatus_idx" ON "Astrologer"("approvalStatus");

-- CreateIndex
CREATE INDEX "Astrologer_price_idx" ON "Astrologer"("price");

-- CreateIndex
CREATE INDEX "Astrologer_rating_idx" ON "Astrologer"("rating");

-- CreateIndex
CREATE INDEX "Astrologer_experience_idx" ON "Astrologer"("experience");

-- CreateIndex
CREATE INDEX "AstrologerApproved_name_idx" ON "AstrologerApproved"("name");

-- CreateIndex
CREATE INDEX "AstrologerApproved_experience_idx" ON "AstrologerApproved"("experience");

-- CreateIndex
CREATE INDEX "AstrologerApproved_isActive_idx" ON "AstrologerApproved"("isActive");

-- CreateIndex
CREATE INDEX "AstrologerDocument_astrologerId_idx" ON "AstrologerDocument"("astrologerId");

-- CreateIndex
CREATE INDEX "AstrologerDocument_status_idx" ON "AstrologerDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerDocument_astrologerId_documentType_key" ON "AstrologerDocument"("astrologerId", "documentType");

-- CreateIndex
CREATE INDEX "AstrologerRejectionHistory_astrologerId_idx" ON "AstrologerRejectionHistory"("astrologerId");

-- CreateIndex
CREATE INDEX "AstrologerRejectionHistory_stage_idx" ON "AstrologerRejectionHistory"("stage");

-- CreateIndex
CREATE INDEX "ExperiencePlatform_astrologerId_idx" ON "ExperiencePlatform"("astrologerId");

-- CreateIndex
CREATE INDEX "ExperiencePlatform_platformName_idx" ON "ExperiencePlatform"("platformName");

-- CreateIndex
CREATE INDEX "Interview_astrologerId_idx" ON "Interview"("astrologerId");

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_astrologerId_roundNumber_key" ON "Interview"("astrologerId", "roundNumber");

-- CreateIndex
CREATE INDEX "Permission_name_idx" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_createdAt_idx" ON "Permission"("createdAt");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_createdAt_idx" ON "Role"("createdAt");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
