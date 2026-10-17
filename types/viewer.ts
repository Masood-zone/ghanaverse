import type { CatalogueCardItem } from "@/components/catalogue/content-card"
export type ViewerProfile = {
  id: string
  name: string
  avatar: string | null
  image: string | null
  isKids: boolean
  autoplayNextEpisode: boolean
  preferSubtitles: boolean
}
export type ProfilesData = { profiles: ViewerProfile[]; activeId?: string }
export type AccountData = {
  id: string
  name: string
  email: string
  image: string | null
  role: "ADMIN" | "VIEWER" | "RIGHTS_HOLDER"
  hasRightsHolderReports: boolean
  phone: string | null
  phoneVerifiedAt: string | null
  transactionalSmsConsent: boolean
  profiles: ViewerProfile[]
  activeId?: string
}
export type PublicAsset = {
  id: string
  sourceType: string
  isPlayable: boolean
}
export type LibraryTitle = CatalogueCardItem & {
  id: string
  backdropUrl: string | null
  isPremium: boolean
  videoAssets: PublicAsset[]
}
export type LibraryData = {
  profile: ViewerProfile | null
  watchlist: { id: string; content: LibraryTitle }[]
  history: {
    id: string
    positionSeconds: number
    durationSeconds: number | null
    completed: boolean
    lastWatchedAt: string
    content: LibraryTitle | null
    episode: {
      id: string
      title: string
      thumbnailUrl: string | null
      videoAssets: PublicAsset[]
      season: { series: LibraryTitle }
    } | null
  }[]
}
