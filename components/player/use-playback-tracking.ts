"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  PlaybackTracker,
  type PlaybackObservation,
} from "@/lib/player-tracking"
import { flushProgress } from "@/services/viewer/playback"
import { ProgressQueue } from "@/lib/progress-queue"
type Snapshot = {
  positionSeconds: number
  durationSeconds?: number
  watchedMilliseconds: number
  coverage: [number, number][]
  sequence: number
  completed: boolean
}

export function usePlaybackTracking(assetId: string, profileId?: string) {
  const tracker = useMemo(() => new PlaybackTracker(), [])
  const identity = useRef<{
    key: string
    request?: Promise<string>
    id?: string
    sequence: number
    started: boolean
  }>({ key: "", sequence: 0, started: false })
  const [saveError, setSaveError] = useState("")
  const client = useQueryClient()
  const session = useCallback(async () => {
    const value = identity.current
    value.key ||= crypto.randomUUID()
    if (!value.request)
      value.request = fetch("/api/playback/sessions", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videoAssetId: assetId,
          profileId,
          idempotencyKey: value.key,
        }),
      })
        .then(async (response) => {
          const body = await response.json()
          if (!response.ok || !body.success || !body.data?.id)
            throw new Error("Stream could not be recorded")
          value.id = body.data.id
          return value.id!
        })
        .catch((error) => {
          value.request = undefined
          throw error
        })
    return value.request
  }, [assetId, profileId])
  const observe = useCallback(
    (state: PlaybackObservation) => {
      tracker.observe(
        { ...state, visible: document.visibilityState === "visible" },
        performance.now()
      )
    },
    [tracker]
  )
  const start = useCallback(() => {
    identity.current.started = true
    void session()
      .then(() => setSaveError(""))
      .catch(() =>
        setSaveError(
          "Your stream could not be recorded yet. We’ll retry while you watch."
        )
      )
  }, [session])
  const queue = useRef<ProgressQueue<Snapshot> | null>(null)
  const flush = useCallback(
    async (completed = false) => {
      if (!identity.current.started) return false
      queue.current ??= new ProgressQueue<Snapshot>(
        async (snapshot) => {
          const sessionId = await session()
          await flushProgress({
            videoAssetId: assetId,
            profileId,
            positionSeconds: snapshot.positionSeconds,
            durationSeconds: snapshot.durationSeconds,
            completed: snapshot.completed,
            telemetry: {
              sessionId,
              sequence: snapshot.sequence,
              watchedMilliseconds: snapshot.watchedMilliseconds,
              coverage: snapshot.coverage,
            },
          })
          void client.invalidateQueries({ queryKey: ["viewer", "library"] })
        },
        (snapshot) =>
          JSON.stringify([
            snapshot.positionSeconds,
            snapshot.durationSeconds,
            snapshot.watchedMilliseconds,
            snapshot.completed,
          ])
      )
      // Capture the observation before awaiting the network or tearing down a player.
      const state = tracker.observation
      const snapshot = {
        positionSeconds: Math.max(0, Math.floor(state.position)),
        durationSeconds:
          Number.isFinite(state.duration) && state.duration > 0
            ? Math.max(1, Math.round(state.duration))
            : undefined,
        watchedMilliseconds: Math.floor(tracker.watchedMilliseconds),
        coverage: tracker.coverage.map(
          (range) => [...range] as [number, number]
        ),
        sequence: ++identity.current.sequence,
        completed,
      }
      try {
        await queue.current.enqueue(snapshot)
        setSaveError("")
        return true
      } catch {
        setSaveError(
          "Viewing progress could not be saved. We’ll retry while you watch."
        )
        return false
      }
    },
    [assetId, profileId, tracker, session, client]
  )
  useEffect(() => {
    const interval = window.setInterval(() => {
      void flush()
    }, 15000)
    const hide = () => {
      tracker.observe(
        { ...tracker.observation, playing: false, visible: false },
        performance.now()
      )
      void flush()
    }
    const visibility = () => {
      if (document.visibilityState !== "visible") hide()
    }
    window.addEventListener("pagehide", hide)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("pagehide", hide)
      document.removeEventListener("visibilitychange", visibility)
      void flush()
    }
  }, [tracker, flush])
  return { observe, start, flush, saveError }
}
