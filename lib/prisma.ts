import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/app/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is required.")
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
        schema:
          new URL(connectionString).searchParams.get("schema") ?? "public",
      }
    ),
  })
  globalForPrisma.prisma = prisma
  return prisma
}
