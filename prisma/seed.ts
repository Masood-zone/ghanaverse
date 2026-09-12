import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ContentType,
  MediaRights,
  PublicationStatus,
  UserRole,
} from "../src/generated/prisma/enums";

const catalogue = [
  [
    "Echoes of the Volta",
    "echoes-of-the-volta",
    ContentType.DOCUMENTARY,
    "A journey along the Volta through memory, music, and community.",
    "Culture",
    "PG",
  ],
  [
    "Accra After Rain",
    "accra-after-rain",
    ContentType.MOVIE,
    "Two strangers find an unexpected connection after a city storm.",
    "Romance",
    "13+",
  ],
  [
    "Kente & Kin",
    "kente-and-kin",
    ContentType.CULTURAL_PROGRAMME,
    "Artisans trace the living stories woven into Kente cloth.",
    "Culture",
    "PG",
  ],
  [
    "Sunday at Makola",
    "sunday-at-makola",
    ContentType.LIFESTYLE_PROGRAMME,
    "A colourful market-day celebration of food, fashion, and friendship.",
    "Lifestyle",
    "PG",
  ],
  [
    "The Cocoa Road",
    "the-cocoa-road",
    ContentType.DOCUMENTARY,
    "A thoughtful portrait of growers shaping Ghana's cocoa future.",
    "Documentary",
    "PG",
  ],
  [
    "Chale, Let Us Talk",
    "chale-let-us-talk",
    ContentType.MOVIE,
    "Old friends reunite for one unforgettable Accra evening.",
    "Comedy",
    "13+",
  ],
  [
    "Northern Lights Ghana",
    "northern-lights-ghana",
    ContentType.CULTURAL_PROGRAMME,
    "Music, dance, and storytelling from northern Ghana.",
    "Culture",
    "PG",
  ],
  [
    "Palmwine Stories",
    "palmwine-stories",
    ContentType.SERIES,
    "A neighbourhood ensemble discovers that every family has a story.",
    "Drama",
    "13+",
  ],
  [
    "The Last Tro-Tro",
    "the-last-tro-tro",
    ContentType.MOVIE,
    "A late-night journey becomes a lesson in generosity.",
    "Drama",
    "13+",
  ],
  [
    "Kitchen on the Coast",
    "kitchen-on-the-coast",
    ContentType.LIFESTYLE_PROGRAMME,
    "Coastal cooks share recipes that travel through generations.",
    "Lifestyle",
    "PG",
  ],
  [
    "Highlife, Home",
    "highlife-home",
    ContentType.DOCUMENTARY,
    "Musicians revisit the rhythms that carry Ghana across generations.",
    "Documentary",
    "PG",
  ],
  [
    "Kumasi Sketchbook",
    "kumasi-sketchbook",
    ContentType.SERIES,
    "Young creatives document a city in motion.",
    "Drama",
    "13+",
  ],
] as const;

async function main() {
  if (process.env.ALLOW_DEV_SEED !== "true")
    throw new Error(
      "Set ALLOW_DEV_SEED=true before running the development seed.",
    );
  const connectionString = process.env.DATABASE_URL;
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!connectionString || !password)
    throw new Error(
      "DATABASE_URL and SEED_DEMO_PASSWORD are required for the development seed.",
    );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    for (const account of [
      { email: "ama@gmail.com", name: "Ama Viewer", role: UserRole.VIEWER },
      { email: "admin@gmail.com", name: "Efua Admin", role: UserRole.ADMIN },
    ]) {
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
      });
      const user =
        existing ??
        (await prisma.user.create({
          data: { ...account, id: crypto.randomUUID() },
        }));
      const credential = await prisma.account.findUnique({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: user.id,
          },
        },
      });
      if (!credential)
        await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            providerId: "credential",
            accountId: user.id,
            userId: user.id,
            password: await hashPassword(password),
          },
        });
      if (
        account.role === UserRole.VIEWER &&
        !(await prisma.viewerProfile.findFirst({ where: { userId: user.id } }))
      )
        await prisma.viewerProfile.create({
          data: { userId: user.id, name: "Ama", avatar: "kente" },
        });
    }
    for (const [name, slug] of [
      ["Drama", "drama"],
      ["Comedy", "comedy"],
      ["Documentary", "documentary"],
      ["Romance", "romance"],
      ["Culture", "culture"],
      ["Lifestyle", "lifestyle"],
    ] as const)
      await prisma.genre.upsert({
        where: { name },
        update: {},
        create: { name, slug },
      });
    for (const [name, code] of [
      ["English", "en"],
      ["Twi", "tw"],
      ["Ga", "gaa"],
      ["Ewe", "ee"],
      ["Dagbani", "dag"],
    ] as const)
      await prisma.language.upsert({
        where: { code },
        update: {},
        create: { name, code },
      });
    for (const [name, slug] of [
      ["U", "u"],
      ["PG", "pg"],
      ["13+", "13-plus"],
      ["16+", "16-plus"],
      ["18+", "18-plus"],
    ] as const)
      await prisma.classification.upsert({
        where: { name },
        update: {},
        create: { name, slug },
      });
    const company = await prisma.productionCompany.upsert({
      where: { name: "GhanaVerse Academic Studio" },
      update: {},
      create: { name: "GhanaVerse Academic Studio" },
    });
    const rightsHolder = await prisma.rightsHolder.upsert({
      where: { name: "GhanaVerse Demo Collection" },
      update: {},
      create: {
        name: "GhanaVerse Demo Collection",
        notes: "Academic demonstration metadata and media only.",
      },
    });
    const contentBySlug = new Map<string, string>();
    for (const [
      title,
      slug,
      contentType,
      description,
      genreName,
      classification,
    ] of catalogue) {
      const genre = await prisma.genre.findUniqueOrThrow({
        where: { name: genreName },
      });
      let content = await prisma.content.findUnique({ where: { slug } });
      if (!content)
        content = await prisma.content.create({
          data: {
            title,
            slug,
            shortDescription: description,
            description,
            contentType,
            releaseYear: 2025,
            country: "Ghana",
            classification,
            publicationStatus: PublicationStatus.PUBLISHED,
            isFeatured: slug === "echoes-of-the-volta",
            mediaRights: MediaRights.DEMO,
            posterUrl: "/images/fallback-poster.svg",
            backdropUrl: "/images/fallback-backdrop.svg",
            productionCompanyId: company.id,
            rightsHolderId: rightsHolder.id,
            publishedAt: new Date(),
            genres: { create: { genreId: genre.id } },
          },
        });
      const missing: Record<string, unknown> = {};
      if (!content.classification) missing.classification = classification;
      if (!content.posterUrl) missing.posterUrl = "/images/fallback-poster.svg";
      if (!content.backdropUrl)
        missing.backdropUrl = "/images/fallback-backdrop.svg";
      if (!content.country) missing.country = "Ghana";
      if (Object.keys(missing).length)
        content = await prisma.content.update({
          where: { id: content.id },
          data: missing,
        });
      contentBySlug.set(slug, content.id);
      await prisma.contentGenre.upsert({
        where: {
          contentId_genreId: { contentId: content.id, genreId: genre.id },
        },
        update: {},
        create: { contentId: content.id, genreId: genre.id },
      });
      const english = await prisma.language.findUniqueOrThrow({
        where: { code: "en" },
      });
      await prisma.contentLanguage.upsert({
        where: {
          contentId_languageId: {
            contentId: content.id,
            languageId: english.id,
          },
        },
        update: {},
        create: { contentId: content.id, languageId: english.id },
      });
      if (contentType === ContentType.SERIES) {
        const season = await prisma.season.upsert({
          where: {
            seriesId_seasonNumber: { seriesId: content.id, seasonNumber: 1 },
          },
          update: {},
          create: {
            seriesId: content.id,
            seasonNumber: 1,
            title: "Season 1",
            description: "A GhanaVerse controlled episodic demonstration.",
          },
        });
        for (const episode of [
          {
            episodeNumber: 1,
            title: "First Light",
            description: "The community gathers as a new story begins.",
            runtimeMinutes: 24,
          },
          {
            episodeNumber: 2,
            title: "A New Thread",
            description: "An unexpected choice changes the path ahead.",
            runtimeMinutes: 24,
          },
          {
            episodeNumber: 3,
            title: "Homecoming",
            description: "Old connections return with new possibilities.",
            runtimeMinutes: 26,
          },
        ])
          await prisma.episode.upsert({
            where: {
              seasonId_episodeNumber: {
                seasonId: season.id,
                episodeNumber: episode.episodeNumber,
              },
            },
            update: {},
            create: {
              seasonId: season.id,
              ...episode,
              thumbnailUrl: "/images/fallback-backdrop.svg",
            },
          });
      }
    }
    for (const collection of [
      {
        name: "Trending Across Ghana",
        slug: "trending-across-ghana",
        description: "Curated Ghanaian stories",
        sortOrder: 1,
        slugs: [
          "echoes-of-the-volta",
          "accra-after-rain",
          "palmwine-stories",
          "the-last-tro-tro",
        ],
      },
      {
        name: "Documentaries & Heritage",
        slug: "documentaries-and-heritage",
        description: "Historical vaults and ancestral roots",
        sortOrder: 2,
        slugs: [
          "the-cocoa-road",
          "highlife-home",
          "kente-and-kin",
          "northern-lights-ghana",
        ],
      },
      {
        name: "Culture, Cuisine & Style",
        slug: "culture-cuisine-and-style",
        description: "Contemporary Ghanaian life",
        sortOrder: 3,
        slugs: [
          "sunday-at-makola",
          "kitchen-on-the-coast",
          "kumasi-sketchbook",
        ],
      },
    ]) {
      const row = await prisma.collection.upsert({
        where: { slug: collection.slug },
        update: {},
        create: {
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          sortOrder: collection.sortOrder,
        },
      });
      for (const [sortOrder, slug] of collection.slugs.entries()) {
        const contentId = contentBySlug.get(slug);
        if (contentId)
          await prisma.collectionItem.upsert({
            where: {
              collectionId_contentId: { collectionId: row.id, contentId },
            },
            update: {},
            create: { collectionId: row.id, contentId, sortOrder },
          });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Development seed failed.",
  );
  process.exitCode = 1;
});
