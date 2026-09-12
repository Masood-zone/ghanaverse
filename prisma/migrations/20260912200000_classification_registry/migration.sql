-- Add a durable classification registry while preserving Content.classification.
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Classification_name_key" ON "Classification"("name");
CREATE UNIQUE INDEX "Classification_slug_key" ON "Classification"("slug");

INSERT INTO "Classification" ("id", "name", "slug")
SELECT
  'classification-' || md5("classification"),
  "classification",
  lower(regexp_replace(trim("classification"), '[^a-zA-Z0-9]+', '-', 'g'))
FROM "Content"
WHERE "classification" IS NOT NULL AND trim("classification") <> ''
GROUP BY "classification";

ALTER TABLE "Content"
ADD CONSTRAINT "Content_classification_fkey"
FOREIGN KEY ("classification") REFERENCES "Classification"("name")
ON DELETE RESTRICT ON UPDATE CASCADE;
