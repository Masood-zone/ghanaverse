export type WatchedRange = [number, number]
export function mergeCoverage(
  ranges: WatchedRange[],
  duration: number
): WatchedRange[] {
  const sorted = ranges
    .map(([start, end]): WatchedRange => [
      Math.max(0, start),
      Math.min(duration, end),
    ])
    .filter(
      ([start, end]) =>
        Number.isFinite(start) && Number.isFinite(end) && end > start
    )
    .sort((a, b) => a[0] - b[0])
  const merged: WatchedRange[] = []
  for (const range of sorted) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1] + 0.05)
      last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  return merged
}
export const coverageSeconds = (ranges: WatchedRange[]) =>
  ranges.reduce((sum, [start, end]) => sum + end - start, 0)

export function minutesToSeconds(value: unknown) {
  if (value === "" || value === null || value === undefined) return null
  return Math.round(Number(value) * 60)
}
