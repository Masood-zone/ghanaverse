import "dotenv/config"
if (
  !process.env.TEST_DATABASE_URL ||
  new URL(process.env.TEST_DATABASE_URL).searchParams.get("schema") !==
    "ghanaverse_test"
)
  throw new Error(
    "Run pnpm test:prepare to configure an isolated test database"
  )
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
