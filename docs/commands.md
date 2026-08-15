# Commands

```bash
./start_local.sh          # cold machine → running dev server
npm run dev               # dev server only, assumes Postgres/Redis are up
npm run build             # prisma generate && next build
npm run lint              # eslint
npm run typecheck         # next typegen && tsc --noEmit
npm test                  # vitest run
npm run test:watch
npm run db:migrate        # prisma migrate deploy
npm run db:generate       # prisma generate
```

## Running one test

```bash
npx vitest run lib/license-key.test.ts      # one file
npx vitest run -t "does NOT reopen"         # one test by name
```

Tests live next to the code they cover, `lib/**/*.test.ts`, and run in the `node`
environment — everything under test is server-side logic, so there is no DOM.
Config is `vitest.config.mts` (`.mts` so Vite loads it as ESM rather than
warning about CommonJS).

## Database

```bash
npx prisma migrate dev --name <what-changed>   # after editing prisma/schema.prisma
npm run db:migrate                             # apply pending migrations (CI/prod)
```

The schema is hand-written. Adding a Better Auth plugin usually adds columns;
`npx @better-auth/cli generate` reports which.

## Local stack

`./start_local.sh` stops **every** running container (deliberate — it frees the
ports), brings up Postgres and Redis via `docker-compose.yml`, applies
migrations, and hands over to `next dev`.

There is no seed step. The first administrator is claimed at `/onboarding`; see
[architecture.md](architecture.md#first-run-onboarding).

```bash
docker compose up -d --wait --remove-orphans   # stores only
docker compose down -v                         # wipe and start over
docker compose --profile prod up --build       # run the production image locally
```

## Two prerequisites that bite on a fresh clone

**`generated/` is gitignored.** `@/generated/prisma/client` does not resolve
until `prisma generate` has run. `npm ci` does it through `postinstall`, and
`npm run build` runs it again — but anything using `--ignore-scripts` (the
Dockerfile's deps stage, for one) must run it explicitly.

**`next-env.d.ts` is gitignored but listed in `tsconfig.json`.** Use
`npm run typecheck`, which runs `next typegen` first, rather than bare `tsc`.
