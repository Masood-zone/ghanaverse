import "dotenv/config"
import { spawnSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"
import { resolve } from "node:path"
import pg from "pg"

const url = new URL(process.env.DATABASE_URL ?? "")
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1), PGSSLMODE: "require" }
const bin = process.env.POSTGRES_BIN ?? "C:/Program Files/PostgreSQL/18/bin"
const action = process.argv[2]
function run(name: string, args: string[]) {
  const result=spawnSync(resolve(bin,name+".exe"),args,{env,encoding:"utf8"})
  if(result.status!==0) throw new Error(`${name} failed; database was not reset. ${result.error?.message ?? "Check PostgreSQL connectivity and tool compatibility."}`)
  return result.stdout
}
async function main() {
  const client=new pg.Client({connectionString:process.env.DATABASE_URL})
  await client.connect()
  try {
    if(action === "backup") {
      const directory=resolve(".backups",new Date().toISOString().replace(/[:.]/g,"-"))
      mkdirSync(directory,{recursive:true})
      const file=resolve(directory,"database.dump")
      run("pg_dump",["--format=custom","--no-owner","--no-acl","--file",file])
      const listing=run("pg_restore",["--list",file])
      if(!listing.includes("TABLE DATA")) throw new Error("Backup archive has no table data")
      writeFileSync(resolve(directory,"manifest.json"),JSON.stringify({createdAt:new Date().toISOString(),sha256:createHash("sha256").update(readFileSync(file)).digest("hex"),archiveEntries:listing.split("\n").length},null,2))
      writeFileSync(resolve(".backups","verified.json"),JSON.stringify({directory,databaseHash:createHash("sha256").update(process.env.DATABASE_URL!).digest("hex")}))
      const admins=await client.query('SELECT email, name FROM "User" WHERE role = \'ADMIN\' LIMIT 1')
      if(!process.env.SEED_ADMIN_EMAIL && admins.rows[0]) appendFileSync(".env",`\nSEED_ADMIN_EMAIL=${JSON.stringify(admins.rows[0].email)}\nSEED_ADMIN_NAME=${JSON.stringify(admins.rows[0].name)}\n`)
      if(!process.env.SEED_ADMIN_PASSWORD) appendFileSync(".env",`\nSEED_ADMIN_PASSWORD=${process.env.SEED_DEMO_PASSWORD || randomBytes(24).toString("base64url")}\n`)
      console.log("Verified backup:",directory)
    } else if(action === "reset") {
      const verified=JSON.parse(readFileSync(resolve(".backups","verified.json"),"utf8"))
      if(verified.databaseHash!==createHash("sha256").update(process.env.DATABASE_URL!).digest("hex")) throw new Error("Database target changed after backup")
      const file=resolve(verified.directory,"database.dump")
      const manifest=JSON.parse(readFileSync(resolve(verified.directory,"manifest.json"),"utf8"))
      if(manifest.sha256!==createHash("sha256").update(readFileSync(file)).digest("hex")) throw new Error("Backup checksum mismatch")
      run("pg_restore",["--list",file])
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
      console.log("Authorized development database schema reset after archive verification.")
    } else throw new Error("Use backup or reset")
  } finally {await client.end()}
}
main().catch(()=>{console.error("Database operation failed; inspect connection and backup prerequisites. Credentials were not logged.");process.exitCode=1})
