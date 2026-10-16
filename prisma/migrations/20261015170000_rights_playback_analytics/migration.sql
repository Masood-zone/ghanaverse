-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'RIGHTS_HOLDER';

-- AlterEnum
ALTER TYPE "VideoSourceType" ADD VALUE 'YOUTUBE';

-- AlterTable
ALTER TABLE "RightsHolder" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "RightsHolderMembership" (
    "userId" TEXT NOT NULL,
    "rightsHolderId" TEXT NOT NULL,

    CONSTRAINT "RightsHolderMembership_pkey" PRIMARY KEY ("userId","rightsHolderId")
);

-- CreateTable
CREATE TABLE "PlaybackSession" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "videoAssetId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "episodeId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSampleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "watchedMilliseconds" INTEGER NOT NULL DEFAULT 0,
    "reportedMilliseconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" DOUBLE PRECISION,
    "coverage" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlaybackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybackSample" (
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "watchedMilliseconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybackSample_pkey" PRIMARY KEY ("sessionId","sequence")
);

-- CreateIndex
CREATE INDEX "RightsHolderMembership_rightsHolderId_idx" ON "RightsHolderMembership"("rightsHolderId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybackSession_idempotencyKey_key" ON "PlaybackSession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PlaybackSession_contentId_startedAt_idx" ON "PlaybackSession"("contentId", "startedAt");

-- CreateIndex
CREATE INDEX "PlaybackSession_userId_startedAt_idx" ON "PlaybackSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "PlaybackSession_startedAt_idx" ON "PlaybackSession"("startedAt");

-- CreateIndex
CREATE INDEX "PlaybackSample_createdAt_idx" ON "PlaybackSample"("createdAt");

-- AddForeignKey
ALTER TABLE "RightsHolderMembership" ADD CONSTRAINT "RightsHolderMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsHolderMembership" ADD CONSTRAINT "RightsHolderMembership_rightsHolderId_fkey" FOREIGN KEY ("rightsHolderId") REFERENCES "RightsHolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackSession" ADD CONSTRAINT "PlaybackSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackSession" ADD CONSTRAINT "PlaybackSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ViewerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackSession" ADD CONSTRAINT "PlaybackSession_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackSession" ADD CONSTRAINT "PlaybackSession_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackSession" ADD CONSTRAINT "PlaybackSession_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackSample" ADD CONSTRAINT "PlaybackSample_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaybackSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
