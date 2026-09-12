-- Add the source-specific credit type without rewriting existing credits.
ALTER TYPE "CreditType" ADD VALUE IF NOT EXISTS 'WRITER';

-- Keep GHMoviesDB provenance and supplemental metadata on the existing catalogue model.
ALTER TABLE "Content"
  ADD COLUMN "tagline" TEXT,
  ADD COLUMN "releaseDate" TIMESTAMP(3),
  ADD COLUMN "country" TEXT,
  ADD COLUMN "seriesStatus" TEXT,
  ADD COLUMN "tmdbId" INTEGER,
  ADD COLUMN "imdbId" TEXT,
  ADD COLUMN "sourceRating" DOUBLE PRECISION,
  ADD COLUMN "sourcePayload" JSONB,
  ADD COLUMN "externalWatchLinks" JSONB;

ALTER TABLE "ContentCredit" ADD COLUMN "characterName" TEXT;
ALTER TABLE "Episode" ADD COLUMN "airDate" TIMESTAMP(3);

-- Nullable external IDs remain allowed for manually authored content.
CREATE UNIQUE INDEX "Content_metadataSource_externalId_key"
  ON "Content"("metadataSource", "externalId");
