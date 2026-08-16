# Architecture

A DeepSeek chat client with a self-hosted auth module. Two storage systems, split
on purpose:

- **Chats and messages** live in the browser's IndexedDB (`lib/db.ts` via
  localforage, driven by `store/chatStore.ts`). They never reach the server.
- **Auth only** lives in Postgres (Prisma 7), with Redis as secondary storage for
  sessions. Postgres holds nothing else — four Better Auth tables and the
  migration ledger.

The DeepSeek API key is read server-side only, in `app/api/chat/route.ts`. The
browser never talks to `api.deepseek.com`.

## Auth

The whole of it is documented per flow in
**[modules/auth/](modules/auth/README.md)** — onboarding, activation, sign-up,
approval, sign-in, password reset, authorization and the admin portal, each with
a sequence diagram.

Start there for anything touching accounts, sessions or `/admin`. The two things
worth knowing before you read any of it:

- Authorization is split between `proxy.ts` (cookie presence only, no database)
  and the pages (the real check). They are not interchangeable —
  [modules/auth/authorization.md](modules/auth/authorization.md).
- The `databaseHooks.user.create.before` hook in `lib/auth.ts` forces
  `banned: true` unconditionally. "Simplifying" it to `user.banned ?? true`
  opens the approval gate for every registration —
  [modules/auth/approval.md](modules/auth/approval.md).

## Generator-owned directories — do not hand-edit

`components/ui/`, `components/auth/` and `lib/auth/` are written by
`npx shadcn@latest add` and overwritten wholesale on the next run. They are
excluded in `eslint.config.mjs` for exactly that reason. Regenerate rather than
patch.

The shadcn style is **`new-york-v4`** (`components.json`). The legacy `default`
style 404s on the `combobox` item that better-auth-ui's sign-up view depends on.

Note that `lib/auth.ts` (our server config) and `lib/auth/` (generated) both
exist. TypeScript resolves the file before the directory, so `@/lib/auth` is ours.

## Things that bite

- **Prisma 7 has no query engine.** `lib/prisma.ts` must pass a driver adapter
  (`@prisma/adapter-pg`). Its transaction timeout is raised to 20s because Better
  Auth wraps a whole endpoint — the deliberately slow password hash *and* the
  outbound email — in a single transaction.
- **`sendMail` never throws** (`lib/email.ts`). Auth sends mail inside the
  transaction that writes the user, so throwing would roll the sign-up back and
  lose the account as well as the email. Undeliverable mail is logged with its
  link instead, which is also how local development works with no
  `RESEND_API_KEY`.
- **Resend's `onboarding@resend.dev` only delivers to the account owner.** Every
  other recipient is refused until a domain is verified at resend.com/domains;
  those links appear in the server console instead.
- **`NEXT_PUBLIC_APP_URL` is inlined into the client bundle at build time**, so
  an image is tied to one origin and cannot be promoted between environments — a
  staging deploy needs its own build.
- **Redis runs without persistence.** It is a cache and a coordination surface,
  never a source of truth. A flush signs everyone out, which is survivable; the
  authorization split exists so that it is.
