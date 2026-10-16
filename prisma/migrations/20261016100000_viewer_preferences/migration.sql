ALTER TABLE "ViewerProfile"
  ADD COLUMN "image" TEXT,
  ADD COLUMN "isKids" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoplayNextEpisode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preferSubtitles" BOOLEAN NOT NULL DEFAULT false;
