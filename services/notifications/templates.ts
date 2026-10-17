export type NotificationEvent = NotificationPayload & {
  audienceRightsHolderId?: string
  mode?: "test" | "live"
}
type NotificationPayload =
  | { type: "WELCOME" }
  | { type: "PASSWORD_CHANGED" }
  | {
      type: "PAYMENT_CONFIRMED" | "REFUND_CONFIRMED"
      amountMinor: number
      currency: string
      reference: string
    }
  | {
      type: "PUBLICATION_CHANGED"
      title: string
      status: "PUBLISHED" | "UNPUBLISHED"
    }
  | {
      type: "PAYOUT_RESULT"
      amountMinor: number
      currency: string
      reference: string
      status: "PAID" | "FAILED" | "REVERSED"
    }
  | { type: "ADMIN_ALERT"; message: string }

export function renderNotification(event: NotificationEvent) {
  switch (event.type) {
    case "WELCOME":
      return {
        subject: "Welcome to GhanaVerse",
        text: "Welcome to GhanaVerse, your home for Ghanaian stories. Your account is ready. Explore the catalogue and choose your next story.",
      }
    case "PASSWORD_CHANGED":
      return {
        subject: "Your GhanaVerse password changed",
        text: "Your GhanaVerse password was changed. If you did not make this change, reset your password immediately using the sign-in page and contact support.",
      }
    case "PAYMENT_CONFIRMED":
    case "REFUND_CONFIRMED": {
      const kind = `${event.mode === "test" ? "Test " : ""}${event.type === "PAYMENT_CONFIRMED" ? "Payment" : "Refund"}`
      return {
        subject: `${kind} confirmed on GhanaVerse`,
        text: `GhanaVerse confirms your ${kind.toLowerCase()} of ${event.currency} ${(event.amountMinor / 100).toFixed(2)}. Reference: ${event.reference}. View your account for details.`,
      }
    }
    case "PUBLICATION_CHANGED":
      return {
        subject: "GhanaVerse publication update",
        text: `${event.title} is now ${event.status.toLowerCase()} on GhanaVerse. Open your creator workspace to review its publication details.`,
      }
    case "PAYOUT_RESULT":
      return {
        subject: `${event.mode === "test" ? "Test " : ""}GhanaVerse payout update`,
        text: `Your ${event.mode === "test" ? "test " : ""}GhanaVerse payout of ${event.currency} ${(event.amountMinor / 100).toFixed(2)} is ${event.status.toLowerCase()}. Reference: ${event.reference}. Review your creator payout report for details.`,
      }
    case "ADMIN_ALERT":
      return {
        subject: "GhanaVerse administrator action required",
        text: `${event.message} Review the notification queue at /admin/notifications or payout report at /admin/royalties.`,
      }
  }
}
