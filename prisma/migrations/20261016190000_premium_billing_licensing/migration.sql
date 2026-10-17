-- CreateTable
-- Additive commercial records only; existing catalogue and media are retained.
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL DEFAULT 'premium',
    "amount" INTEGER NOT NULL DEFAULT 4500,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "days" INTEGER NOT NULL DEFAULT 30,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "commercialConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "days" INTEGER NOT NULL DEFAULT 30,
    "email" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "checkoutUrl" TEXT,
    "fee" INTEGER,
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumGrant" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PremiumGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentLicense" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "rightsHolderId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "contractReference" TEXT NOT NULL,
    "commercialUse" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRecipient" (
    "id" TEXT NOT NULL,
    "rightsHolderId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "maskedAccount" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAttempt" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "recipientCode" TEXT NOT NULL,
    "recipientLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvedById" TEXT NOT NULL,
    "transferCode" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhook" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_reference_key" ON "BillingPayment"("reference");

-- CreateIndex
CREATE INDEX "BillingPayment_userId_mode_createdAt_idx" ON "BillingPayment"("userId", "mode", "createdAt");

-- CreateIndex
CREATE INDEX "BillingPayment_mode_status_idx" ON "BillingPayment"("mode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_userId_mode_idempotencyKey_key" ON "BillingPayment"("userId", "mode", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumGrant_paymentId_key" ON "PremiumGrant"("paymentId");

-- CreateIndex
CREATE INDEX "PremiumGrant_userId_mode_endsAt_idx" ON "PremiumGrant"("userId", "mode", "endsAt");

-- CreateIndex
CREATE INDEX "ContentLicense_contentId_status_startsAt_endsAt_idx" ON "ContentLicense"("contentId", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PayoutRecipient_rightsHolderId_mode_status_idx" ON "PayoutRecipient"("rightsHolderId", "mode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRecipient_mode_providerCode_key" ON "PayoutRecipient"("mode", "providerCode");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAttempt_reference_key" ON "PayoutAttempt"("reference");

-- CreateIndex
CREATE INDEX "PayoutAttempt_licenseId_mode_status_idx" ON "PayoutAttempt"("licenseId", "mode", "status");

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumGrant" ADD CONSTRAINT "PremiumGrant_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "BillingPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumGrant" ADD CONSTRAINT "PremiumGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicense" ADD CONSTRAINT "ContentLicense_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicense" ADD CONSTRAINT "ContentLicense_rightsHolderId_fkey" FOREIGN KEY ("rightsHolderId") REFERENCES "RightsHolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecipient" ADD CONSTRAINT "PayoutRecipient_rightsHolderId_fkey" FOREIGN KEY ("rightsHolderId") REFERENCES "RightsHolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAttempt" ADD CONSTRAINT "PayoutAttempt_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "ContentLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAttempt" ADD CONSTRAINT "PayoutAttempt_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PayoutRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
