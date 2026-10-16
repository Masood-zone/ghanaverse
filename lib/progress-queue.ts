// At most one save runs at a time; newer cumulative snapshots replace queued ones.
export class ProgressQueue<T> {
  private pending?: { value: T; key: string }
  private running?: Promise<void>
  private acknowledged?: string
  constructor(
    private readonly send: (value: T) => Promise<void>,
    private readonly key: (value: T) => string
  ) {}
  enqueue(value: T): Promise<void> {
    const key = this.key(value)
    if (key === this.acknowledged && !this.pending && !this.running)
      return Promise.resolve()
    this.pending = { value, key }
    this.running ??= this.drain().finally(() => {
      this.running = undefined
    })
    return this.running
  }
  private async drain() {
    while (this.pending) {
      const item = this.pending
      this.pending = undefined
      if (item.key === this.acknowledged) continue
      try {
        await this.send(item.value)
        this.acknowledged = item.key
      } catch (error) {
        this.pending ??= item
        throw error
      }
    }
  }
}
