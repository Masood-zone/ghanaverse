export const KIDS_CLASSIFICATIONS = ["U", "PG"]
export function canViewContent(
  profile: { isKids: boolean } | null | undefined,
  content: { classification: string | null }
) {
  return (
    !profile?.isKids ||
    KIDS_CLASSIFICATIONS.includes(content.classification ?? "")
  )
}
export function viewerContentWhere(
  profile: { isKids: boolean } | null | undefined
) {
  return profile?.isKids ? { classification: { in: KIDS_CLASSIFICATIONS } } : {}
}
