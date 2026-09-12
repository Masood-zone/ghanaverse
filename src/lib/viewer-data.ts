import "server-only";

import { PublicationStatus } from "@/generated/prisma/enums";
import { catalogueInclude } from "@/lib/catalogue";
import { getOptionalUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/profiles";
import { rankRecommendations } from "@/lib/recommendations";

const progressInclude = {
  content: { include: catalogueInclude },
  episode: { include: { videoAssets: true, season: { include: { series: { include: catalogueInclude } } } } },
} as const;

export async function getHomeData() {
  const prisma = getPrisma();
  const [content, collections, access] = await Promise.all([
    prisma.content.findMany({ where: { publicationStatus: PublicationStatus.PUBLISHED }, include: catalogueInclude, orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }], take: 48 }),
    prisma.collection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" }, include: { content: { include: catalogueInclude } } } } }),
    getOptionalUser(),
  ]);
  const featured = content.find((item) => item.isFeatured && item.backdropUrl) ?? content.find((item) => item.backdropUrl) ?? content[0];
  if (!access) return { content, collections, featured, viewer: null };
  const profile = await getActiveProfile(access.user.id);
  if (!profile) return { content, collections, featured, viewer: { profile: null, watchlist: [], progress: [], recommendations: [] } };
  const [watchlist, progress] = await Promise.all([
    prisma.watchlistItem.findMany({ where: { profileId: profile.id, content: { publicationStatus: PublicationStatus.PUBLISHED } }, include: { content: { include: catalogueInclude } }, orderBy: { createdAt: "desc" }, take: 16 }),
    prisma.watchProgress.findMany({ where: { profileId: profile.id, positionSeconds: { gt: 0 }, completed: false, OR: [{ content: { publicationStatus: PublicationStatus.PUBLISHED } }, { episode: { season: { series: { publicationStatus: PublicationStatus.PUBLISHED } } } }] }, include: progressInclude, orderBy: { lastWatchedAt: "desc" }, take: 16 }),
  ]);
  const sources = [...progress.map((item) => item.content ?? item.episode?.season.series).filter(Boolean), ...watchlist.map((item) => item.content)].slice(0, 10) as typeof content;
  const recommendations = rankRecommendations(content, sources).slice(0, 12);
  return { content, collections, featured, viewer: { profile, watchlist, progress, recommendations } };
}

export async function getLibraryData(userId: string) {
  const profile = await getActiveProfile(userId);
  if (!profile) return { profile: null, watchlist: [], history: [] };
  const prisma = getPrisma();
  const [watchlist, history] = await Promise.all([
    prisma.watchlistItem.findMany({ where: { profileId: profile.id, content: { publicationStatus: PublicationStatus.PUBLISHED } }, include: { content: { include: catalogueInclude } }, orderBy: { createdAt: "desc" } }),
    prisma.watchProgress.findMany({ where: { profileId: profile.id, positionSeconds: { gt: 0 }, OR: [{ content: { publicationStatus: PublicationStatus.PUBLISHED } }, { episode: { season: { series: { publicationStatus: PublicationStatus.PUBLISHED } } } }] }, include: progressInclude, orderBy: { lastWatchedAt: "desc" } }),
  ]);
  return { profile, watchlist, history };
}
