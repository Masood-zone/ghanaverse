import type { readAdmin } from "@/services/admin/operations"
import type { Prisma } from "@/app/generated/prisma/client"
import type { editorInclude } from "@/services/admin/operations"
export type Jsonify<T> = T extends Date
  ? string
  : T extends Array<infer V>
    ? Jsonify<V>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T
export type EditorRecord = Jsonify<
  Prisma.ContentGetPayload<{ include: typeof editorInclude }>
>
export type Option = {
  id: string
  name: string
  slug?: string
  code?: string
  contactEmail?: string | null
  notes?: string | null
  imageUrl?: string | null
  _count?: { contents?: number; credits?: number }
}
export type AdminOptions = {
  genres: Option[]
  languages: Option[]
  classifications: Option[]
  companies: Option[]
  rightsHolders: Option[]
  people: Option[]
}
export type ContentListItem = {
  id: string
  slug: string
  title: string
  posterUrl: string | null
  contentType: string
  classification: string | null
  publicationStatus: string
  releaseYear: number | null
  runtimeMinutes: number | null
  rightsHolder: { name: string } | null
  createdAt: string
  updatedAt: string
}
export type ContentPage = {
  items: ContentListItem[]
  total: number
  page: number
  totalPages: number
}
export type DashboardData = {
  titles: number
  published: number
  drafts: number
  unpublished: number
  viewers: number
  creators: number
  recent: ContentListItem[]
  distribution: { contentType: string; _count: number }[]
  activity: ActivityItem[]
}
export type AdminUser = {
  id: string
  name: string
  email: string
  role: "ADMIN" | "VIEWER"
  isSuspended: boolean
  createdAt: string
  _count: { profiles: number }
}
export type UsersPage = {
  items: AdminUser[]
  total: number
  admins: number
  viewers: number
  suspended: number
  page: number
  totalPages: number
}
export type ActivityItem = {
  id: string
  actorId: string
  actorName?: string
  action: string
  entityType: string
  entityId: string
  createdAt: string
}
export type ActivityPage = {
  items: ActivityItem[]
  total: number
  page: number
  totalPages: number
}
export type CollectionRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  sortOrder: number
  items: {
    contentId: string
    sortOrder: number
    content: { id: string; title: string; publicationStatus: string }
  }[]
}
export type AdminReadResult = Awaited<ReturnType<typeof readAdmin>>
