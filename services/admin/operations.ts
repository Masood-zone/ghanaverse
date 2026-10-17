import "server-only"
import { getPrisma } from "@/lib/prisma"
import { invalidateCatalogue } from "@/lib/catalogue-cache"
import { PlatformError } from "@/lib/route-error"
import { mutateUser } from "./user-operations"
import { mutateCreator } from "./creator-operations"
import { mutateCollection } from "./collection-operations"
import { mutateMetadata } from "./metadata-operations"
import { mutateContent } from "./content-operations"
import { mutateMedia } from "./media-operations"
export { readAdmin, editorInclude } from "./read-models"
export async function mutateAdmin(
  url: URL,
  method: string,
  raw: unknown,
  actorId: string
) {
  const [kind, id, child] = url.pathname.split("/").filter(Boolean).slice(2)
  const result = await getPrisma().$transaction(
    async (tx) => {
      // Serializes last-admin, publication and dependent record changes in this operational release.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(714915)`
      const actor = await tx.user.findUnique({ where: { id: actorId } })
      if (!actor || actor.role !== "ADMIN" || actor.isSuspended)
        throw new PlatformError(
          403,
          "ADMIN_REQUIRED",
          "Administrator access required"
        )
      const context = { tx, id, child, kind, method, raw }
      const result =
        kind === "users"
          ? await mutateUser(context)
          : kind === "creators"
            ? await mutateCreator(context)
            : kind === "collections"
              ? await mutateCollection(context)
              : kind === "metadata"
                ? await mutateMetadata(context)
                : kind === "content" && (!child || child === "publication")
                  ? await mutateContent(context)
                  : await mutateMedia(context)
      if (!result)
        throw new PlatformError(
          404,
          "NOT_FOUND",
          "Unknown administration operation"
        )
      await tx.auditLog.create({
        data: {
          actorId,
          action: `${method}_${kind}${child ? "_" + child : ""}`,
          entityType: kind,
          entityId: result.id,
        },
      })
      return { id: result.id }
    },
    { maxWait: 15000, timeout: 20000 }
  )
  if (kind !== "users") await invalidateCatalogue(kind)
  return result
}
