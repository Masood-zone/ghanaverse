import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "@/app/generated/prisma/client"

export function sqlTable(
  name:
    | "Content"
    | "Season"
    | "Episode"
    | "PlaybackSession"
    | "PlaybackSample"
    | "ViewerProfile"
    | "User"
) {
  const schema =
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "public"
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema))
    throw new Error("Invalid database schema.")
  return Prisma.raw(`"${schema}"."${name}"`)
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is required.")
  const schema =
    new URL(connectionString).searchParams.get("schema") ?? "public"
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema))
    throw new Error("Invalid database schema.")
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 10000,
        max: 5,
        keepAlive: true,
      },
      {
        schema,
      }
    ),
  })
  globalForPrisma.prisma = prisma
  return prisma
}
