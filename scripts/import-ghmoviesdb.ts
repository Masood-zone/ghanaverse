import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importGHMoviesDB } from "../src/lib/importers/ghmoviesdb";

const args = process.argv.slice(2); const flag = (name: string) => args.includes(name); const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const file = value("--file") ?? "data/ghmoviesdb.json"; const limit = Number(value("--limit") ?? 35);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const input = JSON.parse(await readFile(file, "utf8")); const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try { const report = await importGHMoviesDB(db, input, { limit, dryRun: flag("--dry-run"), updateExisting: flag("--update-existing") }); console.log(JSON.stringify({ mode: flag("--dry-run") ? "dry-run" : flag("--update-existing") ? "update-existing" : "insert-only", file, ...report }, null, 2)); } finally { await db.$disconnect(); }
