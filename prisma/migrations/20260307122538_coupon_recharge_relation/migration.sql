-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('CHAT', 'CALL');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'STRIPE', 'CASHFREE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "CouponVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "UserWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceCoins" INTEGER NOT NULL DEFAULT 0,
    "lockedCoins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerWallet" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "balanceCoins" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalWithdrawn" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userWalletId" TEXT,
    "astrologerWalletId" TEXT,
    "rechargePackId" TEXT,
    "sessionId" TEXT,
    "paymentId" TEXT,
    "type" "TransactionType" NOT NULL,
    "coins" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "astrologerWalletId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "coins" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "transactionRef" TEXT,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "type" "SessionType" NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "ratePerMin" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "coinsDeducted" INTEGER NOT NULL DEFAULT 0,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rechargePackId" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "coins" INTEGER NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rechargePackId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "coins" INTEGER NOT NULL,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionConfig" (
    "id" TEXT NOT NULL,
    "chatPercent" DOUBLE PRECISION NOT NULL,
    "callPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "CouponType" NOT NULL,
    "visibility" "CouponVisibility" NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "percentage" DOUBLE PRECISION,
    "flatAmount" DOUBLE PRECISION,
    "maxDiscount" DOUBLE PRECISION,
    "minOrderAmount" DOUBLE PRECISION,
    "redeemLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CouponToRechargePack" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_userId_key" ON "UserWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerWallet_astrologerId_key" ON "AstrologerWallet"("astrologerId");

-- CreateIndex
CREATE INDEX "AstrologerWallet_astrologerId_idx" ON "AstrologerWallet"("astrologerId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userWalletId_idx" ON "WalletTransaction"("userWalletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_astrologerWalletId_idx" ON "WalletTransaction"("astrologerWalletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_sessionId_idx" ON "WalletTransaction"("sessionId");

-- CreateIndex
CREATE INDEX "WalletTransaction_paymentId_idx" ON "WalletTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_paymentId_type_key" ON "WalletTransaction"("paymentId", "type");

-- CreateIndex
CREATE INDEX "Withdrawal_astrologerWalletId_idx" ON "Withdrawal"("astrologerWalletId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_astrologerId_idx" ON "Session"("astrologerId");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentOrderId_key" ON "Payment"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_razorpayOrderId_key" ON "PaymentOrder"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_idx" ON "PaymentOrder"("userId");

-- CreateIndex
CREATE INDEX "PaymentOrder_razorpayOrderId_idx" ON "PaymentOrder"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_idx" ON "PaymentOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionConfig_createdAt_key" ON "CommissionConfig"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "_CouponToRechargePack_AB_unique" ON "_CouponToRechargePack"("A", "B");

-- CreateIndex
CREATE INDEX "_CouponToRechargePack_B_index" ON "_CouponToRechargePack"("B");

-- CreateIndex
CREATE INDEX "RechargePack_isActive_idx" ON "RechargePack"("isActive");

-- CreateIndex
CREATE INDEX "RechargePack_price_idx" ON "RechargePack"("price");

-- CreateIndex
CREATE INDEX "RechargePack_coins_idx" ON "RechargePack"("coins");

-- CreateIndex
CREATE INDEX "RechargePack_createdAt_idx" ON "RechargePack"("createdAt");

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerWallet" ADD CONSTRAINT "AstrologerWallet_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userWalletId_fkey" FOREIGN KEY ("userWalletId") REFERENCES "UserWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_astrologerWalletId_fkey" FOREIGN KEY ("astrologerWalletId") REFERENCES "AstrologerWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_rechargePackId_fkey" FOREIGN KEY ("rechargePackId") REFERENCES "RechargePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_astrologerWalletId_fkey" FOREIGN KEY ("astrologerWalletId") REFERENCES "AstrologerWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rechargePackId_fkey" FOREIGN KEY ("rechargePackId") REFERENCES "RechargePack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_rechargePackId_fkey" FOREIGN KEY ("rechargePackId") REFERENCES "RechargePack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponToRechargePack" ADD CONSTRAINT "_CouponToRechargePack_A_fkey" FOREIGN KEY ("A") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponToRechargePack" ADD CONSTRAINT "_CouponToRechargePack_B_fkey" FOREIGN KEY ("B") REFERENCES "RechargePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
