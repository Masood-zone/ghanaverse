import { isPermittedPlaybackAsset } from "@/lib/image-policy"
export type PlaybackCandidate = {
  id: string
  sourceType: string
  playbackUrl: string
  isPlayable: boolean
}
export function selectPlaybackAsset<T extends PlaybackCandidate>(assets: T[]) {
  return [...assets]
    .sort((a, b) => a.id.localeCompare(b.id))
    .find(isPermittedPlaybackAsset)
}
export type EpisodeSummary = {
  id: string
  seasonId: string
  seasonNumber: number
  episodeNumber: number
  title: string
  description: string | null
  thumbnailUrl: string | null
  runtimeMinutes: number | null
  assetId: string | null
  available: boolean
  positionSeconds: number
  durationSeconds: number | null
  completed: boolean
}
type SeasonInput = {
  id: string
  seasonNumber: number
  episodes: {
    id: string
    episodeNumber: number
    title: string
    description: string | null
    thumbnailUrl: string | null
    runtimeMinutes: number | null
    videoAssets: PlaybackCandidate[]
  }[]
}
type ProgressInput = {
  episodeId: string | null
  positionSeconds: number
  durationSeconds: number | null
  completed: boolean
  lastWatchedAt: Date
}
export function buildSeriesNavigation(
  seasons: SeasonInput[],
  progress: ProgressInput[],
  currentEpisodeId?: string,
  premium = false
) {
  const recent = [...progress].sort(
    (a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime()
  )
  const episodes: EpisodeSummary[] = [...seasons]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((season) =>
      [...season.episodes]
        .sort((a, b) => a.episodeNumber - b.episodeNumber)
        .map((episode) => {
          const saved = recent.find((item) => item.episodeId === episode.id)
          const asset = premium
            ? undefined
            : selectPlaybackAsset(episode.videoAssets)
          return {
            id: episode.id,
            seasonId: season.id,
            seasonNumber: season.seasonNumber,
            episodeNumber: episode.episodeNumber,
            title: episode.title,
            description: episode.description,
            thumbnailUrl: episode.thumbnailUrl,
            runtimeMinutes: episode.runtimeMinutes,
            assetId: asset?.id ?? null,
            available: Boolean(asset),
            positionSeconds: saved?.positionSeconds ?? 0,
            durationSeconds: saved?.durationSeconds ?? null,
            completed: saved?.completed ?? false,
          }
        })
    )
  const index = episodes.findIndex((episode) => episode.id === currentEpisodeId)
  const incomplete = recent.find(
    (item) =>
      !item.completed &&
      item.positionSeconds > 0 &&
      episodes.some((episode) => episode.id === item.episodeId)
  )
  const last = recent.find((item) =>
    episodes.some((episode) => episode.id === item.episodeId)
  )
  const lastIndex = episodes.findIndex(
    (episode) => episode.id === last?.episodeId
  )
  const resume = incomplete
    ? episodes.find((episode) => episode.id === incomplete.episodeId)
    : last
      ? (episodes[lastIndex + 1] ?? episodes[lastIndex])
      : episodes[0]
  return {
    episodes,
    current: episodes[index] ?? null,
    previous: index > 0 ? episodes[index - 1] : null,
    next: index >= 0 ? (episodes[index + 1] ?? null) : null,
    resume: resume ?? null,
  }
}
export function episodeLabel(
  episode: Pick<EpisodeSummary, "seasonNumber" | "episodeNumber">
) {
  return `S${episode.seasonNumber} · E${episode.episodeNumber}`
}
