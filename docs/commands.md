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
npm run db:seed           # reconcile permissions and built-in roles
```

## Keeping the docs true

```
/sync-context                      # in Claude Code — sweep every doc
/sync-context docs/modules/auth    # narrow it
```

Re-validates every claim in the docs against the code as it is now — reading
files, running commands and checking installed versions rather than trusting
what the docs already say — then fixes the drift and reports anything it could
not verify. Leaves changes unstaged.

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

`npm run db:seed` reconciles `auth_permission` with the permission set in
`lib/rbac/statements.ts` and upserts the built-in roles. It is idempotent, keyed
on natural keys, and belongs after every migration — a permission added in code
does not exist to be granted until it has run. A permission in the database that
code no longer defines is reported rather than deleted; `npm run db:seed -- --prune`
removes them deliberately. See [modules/auth/permissions.md](modules/auth/permissions.md).

## Local stack

`./start_local.sh` stops **every** running container (deliberate — it frees the
ports), brings up Postgres and Redis via `docker-compose.yml`, applies
migrations, seeds the permission catalogue, and hands over to `next dev`.

The seed creates no accounts. The first administrator is still claimed at
`/onboarding`; see [architecture.md](architecture.md#first-run-onboarding).

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

## Two dependency pins that look stale

`typescript@^6` and `eslint@^9` are held back deliberately: TypeScript 7 is not
yet supported by `typescript-eslint`, and ESLint 10 breaks the
`eslint-plugin-react` bundled in `eslint-config-next`. Both can be raised once
those catch up. `.github/dependabot.yml` ignores those majors so the same
rejected PR does not reappear weekly — along with `ioredis` (held at v5 by
`@better-auth/redis-storage`'s peer range) and the Node base image (24 is the
newest LTS; 26 is current, which production images should not track).
