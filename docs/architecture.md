# Architecture

A DeepSeek chat client with a self-hosted auth module.

**Postgres (Prisma 7) is the only durable store**, with Redis as secondary
storage for sessions. It holds four Better Auth tables, the five RBAC tables
(`auth_role`, `auth_permission`, `role_permission`, `user_role`,
`access_version`), `chat` and `message`, and the migration ledger.

The DeepSeek API key is read server-side only, in `app/api/chat/route.ts`. The
browser never talks to `api.deepseek.com`.

## Chat storage

Chats and messages are reached exclusively through **`lib/chats.ts`**, which
takes the owner's `userId` as its first argument and applies it *inside* every
query — `WHERE id = ? AND userId = ?`, never a fetch followed by a check. A chat
id belonging to another user therefore matches no row: reads return `null` (the
route answers 404) and writes report zero rows affected. `lib/chats.test.ts`
covers that property with a fake that honours the `where` clause, so dropping the
scoping makes those tests fail rather than silently pass.

The `userId` always comes from `getSessionUserId()` (`lib/api-server.ts`), which
validates the session — never from the request body or a path segment. Every
`/api/chats` handler is wrapped in `withUser()` from the same module, so the id
arrives as an argument and a handler cannot run without one. See
[modules/auth/authorization.md](modules/auth/authorization.md) for why `proxy.ts`
is not a substitute.

On the client, the split is:

- **TanStack Query** owns chats and messages — fetching, caching and
  invalidation (`hooks/use-chats.ts`, over `lib/chat-api.ts`). `app/page.tsx`
  prefetches the chat list into the same key so the sidebar renders populated.
- **Zustand** (`store/chatStore.ts`) holds `currentChatId` and nothing else. It
  is the one piece of genuinely client-side state: a UI choice that never
  round-trips.

Mutations invalidate rather than patching the cache, and none are optimistic —
the server is awaited and its answer is what renders, so the screen cannot show a
message that failed to save.

## Auth

The whole of it is documented per flow in
**[modules/auth/](modules/auth/README.md)** — onboarding, activation, sign-up,
approval, sign-in, password reset, authorization and the admin portal, each with
a sequence diagram.

Start there for anything touching accounts, sessions or `/admin`. The two things
worth knowing before you read any of it:

- Authorization is split three ways: `proxy.ts` (cookie presence only, no
  database), the Data Access Layer in `lib/rbac/dal.ts` (session and permissions,
  memoized per request), and the page or route handler (the real check). They are
  not interchangeable — [modules/auth/authorization.md](modules/auth/authorization.md).
- Permissions are defined in code and roles in Postgres. `User.role` is a
  *mirror* of the `user_role` join table, written only by `lib/rbac/roles.ts` and
  only through Better Auth's internal adapter — a direct `prisma.user.update`
  leaves every cached session reporting the old roles.
  [modules/auth/permissions.md](modules/auth/permissions.md).
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
