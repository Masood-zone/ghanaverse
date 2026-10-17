ALTER TABLE "User" ADD COLUMN "phone" TEXT,
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN "transactionalSmsConsent" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'DELIVERED', 'AMBIGUOUS', 'FAILED', 'CANCELLED');

CREATE TABLE "PhoneVerification" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 1,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resendAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "NotificationOutbox" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventKey" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientAddress" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "event" JSONB NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "providerMessageId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationOutbox_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationOutbox_eventKey_recipientId_channel_key" ON "NotificationOutbox"("eventKey", "recipientId", "channel");
CREATE INDEX "NotificationOutbox_status_nextAttemptAt_idx" ON "NotificationOutbox"("status", "nextAttemptAt");
