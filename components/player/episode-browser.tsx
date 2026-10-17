"use client"
import { SelectField } from "@/components/ui/select-field"
import { SelectItem } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import Link from "next/link"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { episodeLabel, type EpisodeSummary } from "@/lib/series"
export function EpisodeBrowser({
  episodes,
  currentId,
  initialSeasonId,
  backdrop,
}: {
  episodes: EpisodeSummary[]
  currentId?: string
  initialSeasonId?: string
  backdrop?: string | null
}) {
  const [seasonId, setSeasonId] = useState(
    initialSeasonId ?? episodes[0]?.seasonId ?? ""
  )
  const seasons = [
    ...new Map(
      episodes.map((episode) => [episode.seasonId, episode.seasonNumber])
    ).entries(),
  ]
  if (!episodes.length)
    return (
      <section id="episodes" className="rounded-xl border bg-white p-5 md:p-7">
        <h2 className="text-xl font-extrabold">Episodes</h2>
        <p className="mt-5 text-sm text-muted-foreground">
          No episodes have been listed for this series yet.
        </p>
      </section>
    )
  return (
    <section id="episodes" className="rounded-xl border bg-white p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Episodes</h2>
        <Label className="text-sm font-semibold">
          Season{" "}
          <SelectField
            aria-label="Choose season"
            className="ml-2 rounded-md border bg-white p-2"
            value={seasonId}
            onValueChange={(event) => setSeasonId(event)}
          >
            {seasons.map(([id, number]) => (
              <SelectItem key={id} value={id}>
                Season {number}
              </SelectItem>
            ))}
          </SelectField>
        </Label>
      </div>
      {episodes.length ? (
        <div className="mt-5 space-y-3">
          {episodes
            .filter((episode) => episode.seasonId === seasonId)
            .map((episode) => (
              <article
                key={episode.id}
                aria-current={currentId === episode.id ? "true" : undefined}
                className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[160px_1fr] ${currentId === episode.id ? "border-primary bg-amber-50" : "bg-muted/50"}`}
              >
                <div className="relative aspect-video overflow-hidden rounded-md">
                  <ContentArtwork
                    src={episode.thumbnailUrl ?? backdrop}
                    alt={`${episodeLabel(episode)} thumbnail`}
                    variant="landscape"
                  />
                  {episode.durationSeconds ? (
                    <progress
                      aria-label={`${episode.title} progress`}
                      value={
                        episode.completed
                          ? episode.durationSeconds
                          : episode.positionSeconds
                      }
                      max={episode.durationSeconds}
                      className="absolute inset-x-0 bottom-0 h-1 w-full accent-primary"
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">
                    {episodeLabel(episode)}
                    {currentId === episode.id
                      ? " · Now playing"
                      : episode.completed
                        ? " · Watched"
                        : ""}
                  </p>
                  <h3 className="mt-1 font-bold">{episode.title}</h3>
                  {episode.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {episode.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {episode.runtimeMinutes
                        ? `${episode.runtimeMinutes} min`
                        : ""}
                    </span>
                    {currentId === episode.id ? (
                      <span className="text-sm font-bold text-primary">
                        Now playing
                      </span>
                    ) : episode.assetId ? (
                      <Link
                        href={`/watch/${episode.assetId}`}
                        className="text-sm font-bold text-primary"
                      >
                        {episode.completed
                          ? "Replay"
                          : episode.positionSeconds > 0
                            ? "Resume"
                            : "Play"}
                        <span className="sr-only">
                          {" "}
                          {episodeLabel(episode)}: {episode.title}
                        </span>{" "}
                        →
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          No episodes have been listed for this series yet.
        </p>
      )}
    </section>
  )
}
