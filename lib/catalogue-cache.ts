import "server-only"
import { revalidateTag } from "next/cache"

export const CATALOGUE_TAG = "ghanaverse:catalogue"
export const CATALOGUE_REFERENCE_TAG = "ghanaverse:catalogue-reference"
export const COLLECTIONS_TAG = "ghanaverse:collections"

// Expire immediately: unpublished/deleted titles must not be served stale.
// Call only after the business transaction has committed.
export async function invalidateCatalogue(kind = "content") {
  await revalidateTag(CATALOGUE_TAG, { expire: 0 })
  if (kind === "collections")
    await revalidateTag(COLLECTIONS_TAG, { expire: 0 })
  if (kind === "metadata")
    await revalidateTag(CATALOGUE_REFERENCE_TAG, { expire: 0 })
}
