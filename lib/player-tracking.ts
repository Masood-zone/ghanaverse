import { mergeCoverage, type WatchedRange } from "@/lib/playback-metrics"
export type PlaybackObservation = {
  seeking?: boolean
  position: number
  duration: number
  playing: boolean
  visible: boolean
  rate: number
}
export class PlaybackTracker {
  watchedMilliseconds = 0
  coverage: WatchedRange[] = []
  observation: PlaybackObservation = {
    position: 0,
    duration: 0,
    playing: false,
    visible: true,
    rate: 1,
  }
  private previous?: { state: PlaybackObservation; time: number }
  observe(state: PlaybackObservation, time: number) {
    const previous = this.previous
    if (
      previous &&
      previous.state.playing &&
      !previous.state.seeking &&
      !state.seeking &&
      previous.state.visible &&
      state.visible
    ) {
      const elapsed = time - previous.time,
        advanced = state.position - previous.state.position
      const rate = Math.max(state.rate, previous.state.rate)
      if (
        elapsed > 0 &&
        elapsed <= 3000 &&
        advanced > 0 &&
        advanced <= (elapsed / 1000) * rate + 0.5
      ) {
        this.watchedMilliseconds += Math.min(elapsed, (advanced / rate) * 1000)
        this.coverage = mergeCoverage(
          [...this.coverage, [previous.state.position, state.position]],
          state.duration || 86400
        )
      }
    }
    this.observation = state
    this.previous = { state, time }
  }
}
