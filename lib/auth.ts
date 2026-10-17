import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import { UserRole } from "@/app/generated/prisma/enums"
import { getPrisma } from "@/lib/prisma"
import { DEFAULT_REGISTRATION_ROLE } from "@/lib/auth/policy"
import { enqueueUserNotification } from "@/services/notifications/outbox"
import { sendRecoveryEmail } from "@/services/notifications/providers"

function createAuth(secret: string, baseURL: string) {
  return betterAuth({
    baseURL,
    secret,
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendRecoveryEmail(user.email, url)
      },
      onPasswordReset: async ({ user }) => {
        // Revoke first even if recording the confirmation encounters a failure.
        await getPrisma().session.deleteMany({ where: { userId: user.id } })
        const account = await getPrisma().account.findFirstOrThrow({
          where: { userId: user.id, providerId: "credential" },
          select: { id: true, updatedAt: true },
        })
        await getPrisma().$transaction((tx) =>
          enqueueUserNotification(tx, {
            eventKey: `password-reset:${account.id}:${account.updatedAt.toISOString()}`,
            userId: user.id,
            event: { type: "PASSWORD_CHANGED" },
          })
        )
      },
    },
    session: { cookieCache: { enabled: false } },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await getPrisma().$transaction((tx) =>
              enqueueUserNotification(tx, {
                eventKey: `welcome:${user.id}`,
                userId: user.id,
                event: { type: "WELCOME" },
              })
            )
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await getPrisma().user.findUnique({
              where: { id: session.userId },
            })
            if (!user || user.isSuspended) return false
            return { data: session }
          },
        },
      },
      account: {
        update: {
          after: async (account, context) => {
            if (context?.path === "/change-password")
              await getPrisma().$transaction((tx) =>
                enqueueUserNotification(tx, {
                  eventKey: `password-change:${account.id}:${account.updatedAt.toISOString()}`,
                  userId: account.userId,
                  event: { type: "PASSWORD_CHANGED" },
                })
              )
          },
        },
        create: {
          before: async (account) => {
            const prisma = getPrisma()
            try {
              const existing = await prisma.viewerProfile.findFirst({
                where: { userId: account.userId },
              })
              if (!existing)
                await prisma.viewerProfile.create({
                  data: {
                    userId: account.userId,
                    name: "My Profile",
                    avatar: "adinkra",
                  },
                })
            } catch (error) {
              try {
                await prisma.user.delete({ where: { id: account.userId } })
              } catch {
                throw new Error("REGISTRATION_CLEANUP_FAILED", { cause: error })
              }
              throw new Error("PROFILE_PROVISIONING_FAILED", { cause: error })
            }
          },
        },
      },
    },
    user: {
      additionalFields: {
        role: {
          type: Object.values(UserRole),
          required: true,
          defaultValue: DEFAULT_REGISTRATION_ROLE,
          input: false,
        },
        isSuspended: {
          type: "boolean",
          required: true,
          defaultValue: false,
          input: false,
        },
      },
    },
  })
}

let authInstance: ReturnType<typeof createAuth> | undefined
export type Auth = ReturnType<typeof createAuth>

export function getAuth() {
  if (authInstance) return authInstance
  const secret = process.env.BETTER_AUTH_SECRET
  const baseURL = process.env.BETTER_AUTH_URL
  if (!secret || !baseURL)
    throw new Error("BETTER_AUTH_SECRET and BETTER_AUTH_URL are required.")
  const configured = createAuth(secret, baseURL)
  authInstance = configured
  return configured
}
