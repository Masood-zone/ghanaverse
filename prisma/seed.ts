import "dotenv/config"
import { hashPassword } from "better-auth/crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL,
    password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password)
    throw new Error("Configure SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD")
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  try {
    const admin = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        id: crypto.randomUUID(),
        email,
        name: process.env.SEED_ADMIN_NAME ?? "GhanaVerse Administrator",
        role: "ADMIN",
        emailVerified: true,
      },
    })
    if (
      !(await db.account.findUnique({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: admin.id,
          },
        },
      }))
    )
      await db.account.create({
        data: {
          id: crypto.randomUUID(),
          providerId: "credential",
          accountId: admin.id,
          userId: admin.id,
          password: await hashPassword(password),
        },
      })
    for (const name of [
      "Drama",
      "Comedy",
      "Documentary",
      "Romance",
      "Culture",
      "Lifestyle",
    ])
      await db.genre.upsert({
        where: { name },
        update: {},
        create: { name, slug: name.toLowerCase() },
      })
    for (const [name, code] of [
      ["English", "en"],
      ["Twi", "tw"],
      ["Ga", "gaa"],
      ["Ewe", "ee"],
      ["Dagbani", "dag"],
    ])
      await db.language.upsert({
        where: { code },
        update: {},
        create: { name, code },
      })
    for (const name of ["U", "PG", "13+", "16+", "18+"])
      await db.classification.upsert({
        where: { name },
        update: {},
        create: { name, slug: name.toLowerCase().replace("+", "-plus") },
      })
    console.log(
      "Administrator and reference metadata seeded. No catalogue or demo accounts created."
    )
  } finally {
    await db.$disconnect()
  }
}
main().catch(() => {
  console.error(
    "Seed failed. Check private administrator configuration and database connectivity."
  )
  process.exitCode = 1
})
