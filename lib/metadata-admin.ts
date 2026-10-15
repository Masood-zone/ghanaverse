import "server-only";

import { getPrisma } from "@/lib/prisma";
import { metadataKindSchema, metadataSchemas } from "@/lib/platform-validation";
import { PlatformError } from "@/lib/route-error";

export type MetadataKind = ReturnType<typeof metadataKindSchema.parse>;

export async function createMetadata(kindValue: string, raw: unknown) {
  const kind = metadataKindSchema.parse(kindValue); const db = getPrisma();
  if (kind === "genres") return db.genre.create({ data: metadataSchemas.genres.parse(raw) });
  if (kind === "languages") return db.language.create({ data: metadataSchemas.languages.parse(raw) });
  if (kind === "classifications") return db.classification.create({ data: metadataSchemas.classifications.parse(raw) });
  if (kind === "production-companies") return db.productionCompany.create({ data: metadataSchemas["production-companies"].parse(raw) });
  return db.rightsHolder.create({ data: metadataSchemas["rights-holders"].parse(raw) });
}

export async function updateMetadata(kindValue: string, id: string, raw: unknown) {
  const kind = metadataKindSchema.parse(kindValue); const db = getPrisma();
  if (kind === "genres") return db.genre.update({ where: { id }, data: metadataSchemas.genres.parse(raw) });
  if (kind === "languages") return db.language.update({ where: { id }, data: metadataSchemas.languages.parse(raw) });
  if (kind === "classifications") return db.classification.update({ where: { id }, data: metadataSchemas.classifications.parse(raw) });
  if (kind === "production-companies") return db.productionCompany.update({ where: { id }, data: metadataSchemas["production-companies"].parse(raw) });
  return db.rightsHolder.update({ where: { id }, data: metadataSchemas["rights-holders"].parse(raw) });
}

export async function deleteMetadata(kindValue: string, id: string) {
  const kind = metadataKindSchema.parse(kindValue); const db = getPrisma();
  let references = 0;
  if (kind === "genres") references = await db.contentGenre.count({ where: { genreId: id } });
  else if (kind === "languages") references = await db.contentLanguage.count({ where: { languageId: id } });
  else if (kind === "classifications") {
    const item = await db.classification.findUnique({ where: { id } });
    references = item ? await db.content.count({ where: { classification: item.name } }) : 0;
  } else if (kind === "production-companies") references = await db.content.count({ where: { productionCompanyId: id } });
  else references = await db.content.count({ where: { rightsHolderId: id } });
  if (references) throw new PlatformError(409, "RECORD_IN_USE", `This record is referenced by ${references} title${references === 1 ? "" : "s"} and cannot be deleted.`);
  if (kind === "genres") await db.genre.delete({ where: { id } });
  else if (kind === "languages") await db.language.delete({ where: { id } });
  else if (kind === "classifications") await db.classification.delete({ where: { id } });
  else if (kind === "production-companies") await db.productionCompany.delete({ where: { id } });
  else await db.rightsHolder.delete({ where: { id } });
  return { id };
}
