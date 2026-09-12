import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { ContentType, MediaRights, PublicationStatus, UserRole } from "../src/generated/prisma/enums";

async function main() {
  if (process.env.ALLOW_DEV_SEED !== "true")
    throw new Error("Set ALLOW_DEV_SEED=true before running the development seed.");
  const connectionString = process.env.DATABASE_URL;
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!connectionString || !password)
    throw new Error("DATABASE_URL and SEED_DEMO_PASSWORD are required for the development seed.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const accounts = [
      { email: "ama@gmail.com", name: "Ama Viewer", role: UserRole.VIEWER },
      { email: "admin@gmail.com", name: "Efua Admin", role: UserRole.ADMIN },
    ];
    for (const account of accounts) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        update: { name: account.name, role: account.role },
        create: { ...account, id: crypto.randomUUID() },
      });
      const passwordHash = await hashPassword(password);
      await prisma.account.upsert({
        where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
        update: { password: passwordHash },
        create: { id: crypto.randomUUID(), providerId: "credential", accountId: user.id, userId: user.id, password: passwordHash },
      });
      if (account.role === UserRole.VIEWER) {
        const profile = await prisma.viewerProfile.findFirst({ where: { userId: user.id } });
        if (!profile) await prisma.viewerProfile.create({ data: { userId: user.id, name: "Ama" } });
      }
    }
    const genres = ["Drama", "Comedy", "Documentary", "Romance", "Culture", "Lifestyle"];
    for (const name of genres) await prisma.genre.upsert({ where: { name }, update: {}, create: { name, slug: name.toLowerCase() } });
    for (const [name, code] of [["English", "en"], ["Twi", "tw"], ["Ga", "gaa"], ["Ewe", "ee"]] as const) await prisma.language.upsert({ where: { code }, update: { name }, create: { name, code } });
    const company = await prisma.productionCompany.upsert({ where: { name: "GhanaVerse Academic Studio" }, update: {}, create: { name: "GhanaVerse Academic Studio" } });
    const rightsHolder = await prisma.rightsHolder.upsert({ where: { name: "GhanaVerse Demo Collection" }, update: {}, create: { name: "GhanaVerse Demo Collection", notes: "Academic demonstration metadata and media only." } });
    const titles = [
      ["Echoes of the Volta", "echoes-of-the-volta", ContentType.DOCUMENTARY, "A journey along the Volta through memory, music, and community.", "Culture"],
      ["Accra After Rain", "accra-after-rain", ContentType.MOVIE, "Two strangers find an unexpected connection after a city storm.", "Romance"],
      ["Kente & Kin", "kente-and-kin", ContentType.CULTURAL_PROGRAMME, "Artisans trace the living stories woven into Kente cloth.", "Culture"],
      ["Sunday at Makola", "sunday-at-makola", ContentType.LIFESTYLE_PROGRAMME, "A colourful market-day celebration of food, fashion, and friendship.", "Lifestyle"],
      ["The Cocoa Road", "the-cocoa-road", ContentType.DOCUMENTARY, "A thoughtful portrait of growers shaping Ghana's cocoa future.", "Documentary"],
      ["Chale, Let Us Talk", "chale-let-us-talk", ContentType.MOVIE, "Old friends reunite for one unforgettable Accra evening.", "Comedy"],
      ["Northern Lights Ghana", "northern-lights-ghana", ContentType.CULTURAL_PROGRAMME, "Music, dance, and storytelling from northern Ghana.", "Culture"],
      ["Palmwine Stories", "palmwine-stories", ContentType.SERIES, "A neighbourhood ensemble discovers that every family has a story.", "Drama"],
      ["The Last Tro-Tro", "the-last-tro-tro", ContentType.MOVIE, "A late-night journey becomes a lesson in generosity.", "Drama"],
      ["Kitchen on the Coast", "kitchen-on-the-coast", ContentType.LIFESTYLE_PROGRAMME, "Coastal cooks share recipes that travel through generations.", "Lifestyle"],
      ["Highlife, Home", "highlife-home", ContentType.DOCUMENTARY, "Musicians revisit the rhythms that carry Ghana across generations.", "Documentary"],
      ["Kumasi Sketchbook", "kumasi-sketchbook", ContentType.SERIES, "Young creatives document a city in motion.", "Drama"],
    ] as const;
    for (const [title, slug, contentType, description, genreName] of titles) {
      const genre = await prisma.genre.findUniqueOrThrow({ where: { name: genreName } });
      const content = await prisma.content.upsert({ where: { slug }, update: {}, create: { title, slug, shortDescription: description, description, contentType, releaseYear: 2025, publicationStatus: PublicationStatus.PUBLISHED, isFeatured: slug === "echoes-of-the-volta", mediaRights: MediaRights.DEMO, productionCompanyId: company.id, rightsHolderId: rightsHolder.id, publishedAt: new Date(), genres: { create: { genreId: genre.id } } } });
      if (contentType === ContentType.SERIES) await prisma.season.upsert({ where: { seriesId_seasonNumber: { seriesId: content.id, seasonNumber: 1 } }, update: {}, create: { seriesId: content.id, seasonNumber: 1, title: "Season 1", episodes: { create: [{ episodeNumber: 1, title: "First Light", runtimeMinutes: 24 }, { episodeNumber: 2, title: "A New Thread", runtimeMinutes: 24 }] } } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Development seed failed.");
  process.exitCode = 1;
});
