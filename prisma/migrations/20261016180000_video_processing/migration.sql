ALTER TABLE "VideoUploadSession" ADD COLUMN "processingObjectKey" TEXT,
ADD COLUMN "processingBytes" BIGINT,
ADD COLUMN "sourceDeleted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "VideoProcessorHeartbeat" (
  "id" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoProcessorHeartbeat_pkey" PRIMARY KEY ("id")
);
