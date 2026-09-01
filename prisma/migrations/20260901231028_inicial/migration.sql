-- CreateEnum
CREATE TYPE "DebtRole" AS ENUM ('DEBTOR', 'CREDITOR');

-- CreateEnum
CREATE TYPE "DebtPaymentMethod" AS ENUM ('PIX', 'BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "DebtPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DebtInterestMode" AS ENUM ('COMPOUND', 'SIMPLE', 'NONE');

-- CreateTable
CREATE TABLE "DebtUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "DebtRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canRegisterPayments" BOOLEAN NOT NULL DEFAULT false,
    "canConfirmPayments" BOOLEAN NOT NULL DEFAULT false,
    "canEditPayments" BOOLEAN NOT NULL DEFAULT false,
    "canDeletePayments" BOOLEAN NOT NULL DEFAULT false,
    "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL,
    "creditorName" TEXT NOT NULL,
    "principalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "description" TEXT,
    "contractDate" TIMESTAMP(3) NOT NULL,
    "interestRateBps" INTEGER NOT NULL DEFAULT 100,
    "interestMode" "DebtInterestMode" NOT NULL DEFAULT 'COMPOUND',
    "expectedPayoffDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "DebtPaymentMethod" NOT NULL,
    "note" TEXT,
    "status" "DebtPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "statusNote" TEXT,
    "registeredById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtReceipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DebtUser_email_key" ON "DebtUser"("email");

-- CreateIndex
CREATE INDEX "DebtSession_userId_idx" ON "DebtSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPasswordResetToken_tokenHash_key" ON "DebtPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DebtPasswordResetToken_userId_idx" ON "DebtPasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_paidAt_idx" ON "DebtPayment"("debtId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_debtId_number_key" ON "DebtPayment"("debtId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DebtReceipt_paymentId_key" ON "DebtReceipt"("paymentId");

-- CreateIndex
CREATE INDEX "DebtAuditLog_entity_entityId_idx" ON "DebtAuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "DebtAuditLog_createdAt_idx" ON "DebtAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DebtSession" ADD CONSTRAINT "DebtSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DebtUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPasswordResetToken" ADD CONSTRAINT "DebtPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DebtUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "DebtUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "DebtUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtReceipt" ADD CONSTRAINT "DebtReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "DebtPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtAuditLog" ADD CONSTRAINT "DebtAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "DebtUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
