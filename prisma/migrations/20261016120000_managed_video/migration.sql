-- AlterTable
ALTER TABLE "VideoAsset" ADD COLUMN     "storedObjectId" TEXT,
ALTER COLUMN "playbackUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VideoUploadSession" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "episodeId" TEXT,
    "destination" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "lastModified" DOUBLE PRECISION NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "licenseType" "MediaRights" NOT NULL,
    "mediaMetadata" JSONB NOT NULL,
    "endpoint" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "providerUploadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoUploadPart" (
    "sessionId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "md5" TEXT NOT NULL,

    CONSTRAINT "VideoUploadPart_pkey" PRIMARY KEY ("sessionId","partNumber")
);

-- CreateTable
CREATE TABLE "VideoStorageReservation" (
    "sessionId" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "VideoStorageReservation_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "StoredVideoObject" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "etag" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'READY',
    "metadata" JSONB NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredVideoObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoUploadSession_idempotencyKey_key" ON "VideoUploadSession"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "VideoUploadSession_objectKey_key" ON "VideoUploadSession"("objectKey");

-- CreateIndex
CREATE INDEX "VideoUploadSession_contentId_status_idx" ON "VideoUploadSession"("contentId", "status");

-- CreateIndex
CREATE INDEX "VideoUploadSession_expiresAt_status_idx" ON "VideoUploadSession"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StoredVideoObject_sessionId_key" ON "StoredVideoObject"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredVideoObject_objectKey_key" ON "StoredVideoObject"("objectKey");

-- CreateIndex
CREATE INDEX "StoredVideoObject_state_idx" ON "StoredVideoObject"("state");

-- CreateIndex
CREATE UNIQUE INDEX "VideoAsset_storedObjectId_key" ON "VideoAsset"("storedObjectId");

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredVideoObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoUploadPart" ADD CONSTRAINT "VideoUploadPart_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VideoUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoStorageReservation" ADD CONSTRAINT "VideoStorageReservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VideoUploadSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredVideoObject" ADD CONSTRAINT "StoredVideoObject_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VideoUploadSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
