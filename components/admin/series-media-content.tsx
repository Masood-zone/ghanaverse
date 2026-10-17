"use client"
import { FormSelect, FormSwitch } from "@/components/ui/form-controls"
import { SettingRow } from "@/components/ui/setting-row"
import { SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { VideoUploadButton } from "@/components/uploads/video-upload-button"
import { AssetPreview } from "@/components/uploads/asset-preview"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { videoRequest } from "@/lib/video/client-api"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  seasonSchema,
  episodeSchema,
  trailerSchema,
  videoAssetSchema,
} from "@/lib/platform-validation"
import { useAdminMutation } from "@/services/admin/queries"
import { toOptionalNumber } from "@/lib/validation/form-values"
import { minutesToSeconds } from "@/lib/playback-metrics"
import type { EditorRecord } from "@/types/admin"
import FileUpload from "@/components/common/FileUpload"
import { FormError } from "./shared"
import { selectPlaybackAsset } from "@/lib/series"
type Season = EditorRecord["seasons"][number]
type Episode = Season["episodes"][number]
function EpisodeForm({
  season,
  episode,
  close,
}: {
  season: Season
  episode?: Episode
  close: () => void
}) {
  const form = useForm<
    z.input<typeof episodeSchema>,
    unknown,
    z.output<typeof episodeSchema>
  >({
    resolver: zodResolver(episodeSchema),
    defaultValues: episode
      ? { ...episode, airDate: episode.airDate }
      : {
          title: "",
          episodeNumber:
            Math.max(0, ...season.episodes.map((item) => item.episodeNumber)) +
            1,
          description: null,
          thumbnailUrl: null,
          runtimeMinutes: null,
        },
  })
  const thumbnailUrl = useWatch({ control: form.control, name: "thumbnailUrl" })
  const mutation = useAdminMutation()
  return (
    <form
      className="grid gap-3 rounded-lg bg-white p-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        mutation.mutate(
          {
            path: episode
              ? `episodes/${episode.id}`
              : `seasons/${season.id}/episodes`,
            method: episode ? "PATCH" : "POST",
            body: values,
          },
          {
            onSuccess: () => {
              toast.success("Episode saved")
              close()
            },
            onError: (e) => toast.error(e.message),
          }
        )
      )}
    >
      <Label className="gv-label">
        Episode number
        <Input
          type="number"
          min="1"
          {...form.register("episodeNumber", { valueAsNumber: true })}
        />
      </Label>
      <Label className="gv-label">
        Title
        <Input {...form.register("title")} />
        <FormError message={form.formState.errors.title?.message} />
      </Label>
      <Label className="gv-label">
        Description
        <Textarea {...form.register("description")} />
      </Label>
      <Label className="gv-label">
        Runtime (minutes)
        <Input
          type="number"
          min="1"
          {...form.register("runtimeMinutes", {
            setValueAs: toOptionalNumber,
          })}
        />
      </Label>
      <FileUpload
        label="Episode thumbnail"
        purpose="episodeThumbnail"
        contentId={season.seriesId}
        value={thumbnailUrl}
        onFilesUploaded={(asset) =>
          form.setValue("thumbnailUrl", asset?.secureUrl ?? null, {
            shouldDirty: true,
          })
        }
      />
      <FormError message={mutation.error?.message} />
      <div className="flex gap-2 md:col-span-2">
        <button className="gv-action" disabled={mutation.isPending}>
          Save episode
        </button>
        <button type="button" className="gv-action secondary" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  )
}
function SeasonForm({
  contentId,
  season,
  close,
  nextSeasonNumber,
}: {
  contentId: string
  season?: Season
  close: () => void
  nextSeasonNumber: number
}) {
  const form = useForm<
    z.input<typeof seasonSchema>,
    unknown,
    z.output<typeof seasonSchema>
  >({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      seasonNumber: season?.seasonNumber ?? nextSeasonNumber,
      title: season?.title ?? "",
      description: season?.description ?? "",
    },
  })
  const mutation = useAdminMutation()
  return (
    <form
      className="my-4 grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-3"
      onSubmit={form.handleSubmit((values) =>
        mutation.mutate(
          {
            path: season
              ? `seasons/${season.id}`
              : `content/${contentId}/seasons`,
            method: season ? "PATCH" : "POST",
            body: values,
          },
          {
            onSuccess: () => {
              toast.success("Season saved")
              close()
            },
            onError: (e) => toast.error(e.message),
          }
        )
      )}
    >
      <Label className="gv-label">
        Season number
        <Input
          type="number"
          min="1"
          {...form.register("seasonNumber", { valueAsNumber: true })}
        />
      </Label>
      <Label className="gv-label">
        Season title
        <Input {...form.register("title")} />
      </Label>
      <Label className="gv-label">
        Description
        <Input {...form.register("description")} />
      </Label>
      <FormError message={mutation.error?.message} />
      <div className="flex gap-2">
        <button className="gv-action" disabled={mutation.isPending}>
          Save season
        </button>
        <button type="button" onClick={close} className="gv-action secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}
export function SeriesMediaContent({
  record,
  disabled,
  section,
}: {
  record: EditorRecord
  disabled: boolean
  section: "episodes" | "video"
}) {
  const client = useQueryClient()
  const [seasonEditing, setSeasonEditing] = useState<
    Season | null | undefined
  >()
  const [episodeEditing, setEpisodeEditing] = useState<{
    season: Season
    episode?: Episode
  } | null>(null)
  const mutation = useAdminMutation()
  const trailer = useForm<
    z.input<typeof trailerSchema>,
    unknown,
    z.output<typeof trailerSchema>
  >({
    resolver: zodResolver(trailerSchema),
    defaultValues: {
      video: record.trailer?.youtubeVideoId ?? "",
      title: record.trailer?.title ?? `${record.title} Trailer`,
    },
  })
  const media = useForm<
    z.input<typeof videoAssetSchema>,
    unknown,
    z.output<typeof videoAssetSchema>
  >({
    resolver: zodResolver(videoAssetSchema),
    defaultValues: {
      sourceType: "REMOTE_URL",
      licenseType: "UNKNOWN",
      playbackUrl: "",
      isPlayable: false,
      episodeId: null,
      durationSeconds: null,
    },
  })
  function remove(path: string, label: string) {
    if (confirm(`Delete ${label}?`))
      mutation.mutate(
        { path, method: "DELETE" },
        {
          onSuccess: () => toast.success("Deleted"),
          onError: (e) => toast.error(e.message),
        }
      )
  }
  const assets = [
    ...record.videoAssets,
    ...record.seasons.flatMap((s) => s.episodes.flatMap((e) => e.videoAssets)),
  ]
  const selectedEpisodeId = useWatch({
    control: media.control,
    name: "episodeId",
  })
  function managePlayback(episodeId: string) {
    media.setValue("episodeId", episodeId, { shouldDirty: true })
    document
      .getElementById("series-media-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
    media.setFocus("playbackUrl")
  }
  return (
    <fieldset
      disabled={disabled}
      className="mt-6 grid min-w-0 grid-cols-1 gap-6"
    >
      <section className="gv-panel" hidden={section !== "video"}>
        <h2 className="text-xl font-bold text-primary">Trailer</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={trailer.handleSubmit((values) =>
            mutation.mutate(
              {
                path: `content/${record.id}/trailer`,
                method: "PUT",
                body: values,
              },
              {
                onSuccess: () => toast.success("Trailer saved"),
                onError: (e) => toast.error(e.message),
              }
            )
          )}
        >
          <Label className="gv-label">
            YouTube ID or URL
            <Input {...trailer.register("video")} />
          </Label>
          <Label className="gv-label">
            Trailer title
            <Input {...trailer.register("title")} />
          </Label>
          <button className="gv-action self-end" disabled={mutation.isPending}>
            Save trailer
          </button>
          <FormError message={trailer.formState.errors.video?.message} />
        </form>
        {record.trailer ? (
          <button
            className="mt-3 text-xs text-red-700"
            type="button"
            onClick={() => remove(`content/${record.id}/trailer`, "trailer")}
          >
            Remove trailer
          </button>
        ) : null}
      </section>
      {record.contentType === "SERIES" ? (
        <section
          className="gv-panel"
          hidden={section !== "episodes"}
          id="panel-episodes"
          role="tabpanel"
          aria-labelledby="tab-episodes"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-72">
              <h2 className="text-xl font-bold text-primary">
                Series & Episodic Management
              </h2>
              <p className="mt-2 text-xs text-slate-600">
                Manage seasons and episodes, and attach playback links.
              </p>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                1. Add a season. 2. Add numbered episodes. 3. Attach and enable
                playback for each episode. 4. Publish the series when its
                metadata is ready. Episodes follow season and episode number,
                including across seasons.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Metadata readiness and playback readiness are separate.
                Catalogue-only series can be published. Unpublish a series
                before changing its episodes or media.
              </p>
            </div>
            <button
              type="button"
              className="gv-action secondary shrink-0 self-start"
              onClick={() => setSeasonEditing(null)}
            >
              ＋ Add Season
            </button>
          </div>
          {seasonEditing !== undefined ? (
            <SeasonForm
              key={seasonEditing?.id ?? "new"}
              contentId={record.id}
              season={seasonEditing ?? undefined}
              nextSeasonNumber={
                Math.max(
                  0,
                  ...record.seasons.map((item) => item.seasonNumber)
                ) + 1
              }
              close={() => setSeasonEditing(undefined)}
            />
          ) : null}
          <div className="mt-5 grid gap-5">
            {record.seasons.map((season) => (
              <section className="rounded-xl bg-white p-4" key={season.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-bold">
                    Season {season.seasonNumber}: {season.title ?? "Untitled"}
                  </h3>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="text-primary"
                      onClick={() => setSeasonEditing(season)}
                    >
                      Edit season
                    </button>
                    <button
                      type="button"
                      className="text-red-700"
                      onClick={() =>
                        remove(
                          `seasons/${season.id}`,
                          "season and all episodes"
                        )
                      }
                    >
                      Delete season
                    </button>
                  </div>
                </div>
                <div className="my-4 divide-y">
                  {season.episodes.map((episode) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                      key={episode.id}
                    >
                      <div className="relative aspect-video w-28 overflow-hidden rounded-lg">
                        <ContentArtwork
                          src={episode.thumbnailUrl}
                          alt={episode.title}
                          variant="backdrop"
                        />
                      </div>
                      <span className="text-sm">
                        <strong className="mr-3 text-primary">
                          {String(episode.episodeNumber).padStart(2, "0")}
                        </strong>
                        {episode.title}
                        <span className="mt-1 block text-xs">
                          {episode.runtimeMinutes
                            ? `${episode.runtimeMinutes} min`
                            : "Runtime not recorded"}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {record.isPremium
                            ? "Premium playback unavailable"
                            : selectPlaybackAsset(episode.videoAssets)
                              ? "Playback ready"
                              : episode.videoAssets.length
                                ? "Playback disabled or unsupported"
                                : "No playback attached"}
                          {episode.videoAssets.length
                            ? ` · ${episode.videoAssets.map((asset) => asset.sourceType).join(", ")}`
                            : ""}
                        </span>
                      </span>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <VideoUploadButton
                          contentId={record.id}
                          episodeId={episode.id}
                          label={`Season ${season.seasonNumber} · Episode ${episode.episodeNumber}: ${episode.title}`}
                          rights={record.mediaRights}
                          compact
                          disabled={disabled}
                        />
                        {episode.videoAssets[0] ? (
                          <AssetPreview
                            id={
                              (
                                selectPlaybackAsset(episode.videoAssets) ??
                                episode.videoAssets[0]
                              ).id
                            }
                          />
                        ) : null}
                        <button
                          type="button"
                          className="font-semibold text-primary"
                          onClick={() => managePlayback(episode.id)}
                        >
                          {episode.videoAssets.length
                            ? "Manage playback"
                            : "Add playback"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEpisodeEditing({ season, episode })}
                        >
                          Edit episode
                        </button>
                        <button
                          className="text-red-700"
                          type="button"
                          onClick={() =>
                            remove(`episodes/${episode.id}`, "episode")
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="gv-action secondary"
                  onClick={() => setEpisodeEditing({ season })}
                >
                  ＋ Add Episode
                </button>
                {episodeEditing?.season.id === season.id ? (
                  <EpisodeForm
                    key={episodeEditing.episode?.id ?? "new"}
                    {...episodeEditing}
                    close={() => setEpisodeEditing(null)}
                  />
                ) : null}
              </section>
            ))}
          </div>
        </section>
      ) : null}
      <section
        className="gv-panel"
        hidden={section !== "video"}
        id="panel-video"
        role="tabpanel"
        aria-labelledby="tab-video"
      >
        <h2 className="text-xl font-bold text-primary">Media & Playback</h2>
        {record.contentType !== "SERIES" ? (
          <div className="my-5 rounded-lg border bg-white p-4">
            <p className="mb-3 font-semibold">Main video · {record.title}</p>
            <VideoUploadButton
              contentId={record.id}
              label={record.title}
              rights={record.mediaRights}
              disabled={disabled}
            />
          </div>
        ) : (
          <p className="my-4 text-sm">
            Upload each episode from its row in the Episodes section.
          </p>
        )}
        <p className="mt-2 text-xs leading-6 text-slate-600">
          Paste a YouTube link for automatic embedding, or a direct HTTPS
          video-file link. YouTube playback must remain free.
        </p>
        <div className="my-4 space-y-3">
          {assets
            .filter(
              (asset) =>
                !selectedEpisodeId || asset.episodeId === selectedEpisodeId
            )
            .map((asset) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 text-xs"
                key={asset.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {asset.sourceType === "MANAGED"
                      ? `Uploaded MP4 · ${asset.durationSeconds ? Math.ceil(asset.durationSeconds / 60) + " min" : "Duration unavailable"}`
                      : asset.playbackUrl}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {asset.isPlayable ? "Playable" : "Stored only"} ·{" "}
                    {asset.licenseType}
                    {asset.episodeId ? " · Episode asset" : ""}
                  </p>
                </div>
                <AssetPreview id={asset.id} />
                <button
                  type="button"
                  disabled={mutation.isPending}
                  className="font-semibold text-primary"
                  onClick={async () => {
                    try {
                      await videoRequest(
                        `video-assets/${asset.id}/selection`,
                        "PATCH",
                        { enabled: !asset.isPlayable }
                      )
                      await client.invalidateQueries()
                      toast.success(
                        asset.isPlayable
                          ? "Playback disabled"
                          : "Playback source selected"
                      )
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Source selection failed"
                      )
                    }
                  }}
                >
                  {asset.isPlayable ? "Disable" : "Use this source"}
                </button>
                <button
                  type="button"
                  className="text-red-700"
                  onClick={() =>
                    remove(`video-assets/${asset.id}`, "playback asset")
                  }
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
        <form
          id="series-media-form"
          className="grid gap-4 md:grid-cols-2"
          onSubmit={media.handleSubmit((values) =>
            mutation.mutate(
              { path: `content/${record.id}/video-assets`, body: values },
              {
                onSuccess: () => {
                  toast.success("Playback asset saved")
                  media.reset()
                },
                onError: (e) => toast.error(e.message),
              }
            )
          )}
        >
          <Label className="gv-label md:col-span-2">
            YouTube or direct-video URL
            <Input {...media.register("playbackUrl")} />
            <FormError message={media.formState.errors.playbackUrl?.message} />
          </Label>
          <Label className="gv-label">
            Source type
            <FormSelect
              aria-label="Source type"
              control={media.control}
              name="sourceType"
            >
              <SelectItem value="REMOTE_URL">Direct video URL</SelectItem>
              <SelectItem value="YOUTUBE">YouTube</SelectItem>
              <SelectItem value="DEMO">Demo</SelectItem>
            </FormSelect>
          </Label>
          <Label className="gv-label">
            Rights
            <FormSelect
              aria-label="Rights"
              control={media.control}
              name="licenseType"
            >
              {[
                "UNKNOWN",
                "ORIGINAL",
                "LICENSED",
                "CREATIVE_COMMONS",
                "PUBLIC_DOMAIN",
                "DEMO",
              ].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </FormSelect>
          </Label>
          {record.contentType === "SERIES" ? (
            <Label className="gv-label">
              Episode
              <FormSelect
                aria-label="Episode"
                control={media.control}
                name="episodeId"
              >
                <SelectItem value="">Choose an episode</SelectItem>
                {record.seasons.flatMap((s) =>
                  s.episodes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      S{s.seasonNumber} E{e.episodeNumber}: {e.title}
                    </SelectItem>
                  ))
                )}
              </FormSelect>
            </Label>
          ) : null}
          <Label className="gv-label">
            Duration in minutes
            <Input
              type="number"
              min="0.016666667"
              step="any"
              {...media.register("durationSeconds", {
                setValueAs: minutesToSeconds,
              })}
            />
          </Label>
          <SettingRow
            title="Enable playback"
            description="Allow viewers to play this asset when its rights and publication requirements are met."
            icon="play_circle"
            className="md:col-span-2"
          >
            {({ labelId, descriptionId }) => (
              <FormSwitch
                control={media.control}
                name="isPlayable"
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
              />
            )}
          </SettingRow>
          <button className="gv-action" disabled={mutation.isPending}>
            Add playback asset
          </button>
        </form>
        <FormError message={mutation.error?.message} />
      </section>
    </fieldset>
  )
}
