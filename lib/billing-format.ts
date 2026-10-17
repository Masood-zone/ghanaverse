export const PASS_DAYS = 30
export const PASS_MS = PASS_DAYS * 86_400_000
export const money = (pesewas: number) => `GHS ${(pesewas / 100).toFixed(2)}`
export const billingDate = (value: string | Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—"
