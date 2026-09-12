import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { UserRole } from "../src/generated/prisma/enums";

async function main() {
  if (process.env.ALLOW_DEV_SEED !== "true")
    throw new Error("Set ALLOW_DEV_SEED=true before running the development seed.");
  const connectionString = process.env.DATABASE_URL;
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!connectionString || !password)
    throw new Error("DATABASE_URL and SEED_DEMO_PASSWORD are required for the development seed.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const accounts = [
      { email: "ama@gmail.com", name: "Ama Viewer", role: UserRole.VIEWER },
      { email: "admin@gmail.com", name: "Efua Admin", role: UserRole.ADMIN },
    ];
    for (const account of accounts) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        update: { name: account.name, role: account.role },
        create: { ...account, id: crypto.randomUUID() },
      });
      const passwordHash = await hashPassword(password);
      await prisma.account.upsert({
        where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
        update: { password: passwordHash },
        create: { id: crypto.randomUUID(), providerId: "credential", accountId: user.id, userId: user.id, password: passwordHash },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Development seed failed.");
  process.exitCode = 1;
});
