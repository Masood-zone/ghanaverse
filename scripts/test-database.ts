import "dotenv/config"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
const root = process.cwd(),
  bin = process.env.POSTGRES_BIN ?? "C:/Program Files/PostgreSQL/18/bin"
const directory = resolve(root, ".test-postgres"),
  data = resolve(directory, "data")
function run(name: string, args: string[]) {
  const result = spawnSync(resolve(bin, name + ".exe"), args, {
    stdio: "ignore",
    windowsHide: true,
    timeout: 40000,
  })
  if (result.status !== 0)
    throw new Error(`Local test PostgreSQL ${name} failed`)
}
async function main() {
  if (process.argv.includes("--stop-local")) {
    run("pg_ctl", ["-D", data, "stop", "-m", "fast", "-w"])
    console.log("Disposable test PostgreSQL stopped")
    return
  }
  const useLocal =
    process.argv.includes("--local") ||
    Boolean(process.env.TEST_DATABASE_URL?.includes("127.0.0.1:55439"))
  let testUrl = process.env.TEST_DATABASE_URL
  if (useLocal) {
    if (!data.startsWith(root + "\\") && !data.startsWith(root + "/"))
      throw new Error("Test database must be inside workspace")
    mkdirSync(directory, { recursive: true })
    if (!existsSync(resolve(data, "PG_VERSION")))
      run("initdb", [
        "-D",
        data,
        "-A",
        "trust",
        "-U",
        "postgres",
        "--encoding=UTF8",
        "--locale=C",
        "--no-instructions",
      ])
    const status = spawnSync(
      resolve(bin, "pg_ctl.exe"),
      ["-D", data, "status"],
      { encoding: "utf8", windowsHide: true }
    )
    if (status.status !== 0)
      run("pg_ctl", [
        "-D",
        data,
        "-l",
        resolve(directory, "postgres.log"),
        "-o",
        "-p 55439 -h 127.0.0.1",
        "-w",
        "-t",
        "30",
        "start",
      ])
    testUrl =
      "postgresql://postgres@127.0.0.1:55439/postgres?schema=ghanaverse_test"
    const env = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((line) => !line.startsWith("TEST_DATABASE_URL="))
      .join("\n")
    writeFileSync(".env", env + `\nTEST_DATABASE_URL=${testUrl}\n`)
  }
  if (
    !testUrl ||
    new URL(testUrl).searchParams.get("schema") !== "ghanaverse_test"
  )
    throw new Error(
      "Configure TEST_DATABASE_URL for an isolated ghanaverse_test schema, or use --local"
    )
  const result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: testUrl },
      encoding: "utf8",
      windowsHide: true,
    }
  )
  if (result.status !== 0) throw new Error("Test schema migration failed")
  console.log(
    `Migrations applied to isolated ${useLocal ? "local" : "configured"} ghanaverse_test schema`
  )
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Test database setup failed"
  )
  process.exitCode = 1
})
