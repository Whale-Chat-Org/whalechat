import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The Prisma CLI runs outside Next, so nothing has loaded the env for it. Next
// itself prefers .env.local over .env; match that order here so the CLI and the
// app always agree on which database they are pointed at.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
