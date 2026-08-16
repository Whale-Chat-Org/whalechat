# Auth module

[Better Auth](https://better-auth.com) as a self-hosted library — Postgres
through Prisma for the records, Redis for sessions, Resend for the mail.

## There is no Better Auth service here

Nothing in this project talks to a hosted Better Auth product. There is no
account to create, no API key to obtain, and no dashboard behind it.

- `@better-auth/infra` — the SDK for the hosted dashboard and `sentinel()` — is
  **not installed**, and no `dash()` / `sentinel()` plugin is configured.
- No `BETTER_AUTH_API_KEY`, `BETTER_AUTH_API_URL` or `BETTER_AUTH_KV_URL` exists
  in the source or in any env file.
- `telemetry: { enabled: false }` is stated explicitly in `lib/auth.ts` rather
  than left to the default. (It does not close the environment route — the check
  is `env(BETTER_AUTH_TELEMETRY) || options.telemetry.enabled`, so that variable
  must simply stay unset.)

**`BETTER_AUTH_SECRET` is not a service credential.** The name invites the
opposite reading, but it is a local signing key for session cookies and
verification tokens, which you generate yourself with
`openssl rand -base64 32`. It is registered with nobody and never leaves the
deployment.

The only outbound calls the auth module makes are to Resend, to send mail.

The screens are [Better Auth UI](https://better-auth-ui.com) components installed
from its shadcn registry into `components/auth/`. **Regenerate, don't hand-edit**
— see [../../architecture.md](../../architecture.md#generator-owned-directories--do-not-hand-edit).

## Flows

| Doc | Route | What it covers |
|---|---|---|
| [onboarding.md](onboarding.md) | `/onboarding` | The first administrator claims the instance |
| [activation.md](activation.md) | `/onboarding` | Entering the license key; resend and start-over |
| [sign-up.md](sign-up.md) | `/auth/sign-up` | Registration and email verification |
| [approval.md](approval.md) | `/admin` | The `banned` column, and how access is granted |
| [sign-in.md](sign-in.md) | `/auth/sign-in` | Signing in, the ban response, signing out |
| [password-reset.md](password-reset.md) | `/auth/forgot-password` | Forgot and reset |
| [authorization.md](authorization.md) | every request | `proxy.ts` vs the DAL vs the handler |
| [permissions.md](permissions.md) | every request | Roles, permissions, the `User.role` mirror |
| [admin-portal.md](admin-portal.md) | `/admin` | Users, roles, sessions, impersonation |

Every auth view is served by one route, `app/auth/[path]/page.tsx`, which maps
the URL segment to a Better Auth UI view: `sign-in`, `sign-up`,
`forgot-password`, `reset-password`, `reset-link-sent`, `verify-email`,
`sign-out`, `redirect`.

## Where the code is

| Path | Role |
|---|---|
| `lib/auth.ts` | Server config — adapter, secondary storage, hooks, `admin()` plugin |
| `lib/auth-client.ts` | Browser client, with `adminClient()` |
| `lib/access.ts` | Ban-reason strings, built-in role keys and the `User.role` mirror codec; deliberately free of server imports so client components can use them |
| `lib/onboarding.ts` | First-run state machine |
| `lib/session.ts` | `getServerSession`, `isAdmin` |
| `lib/rbac/` | The permission set, the Data Access Layer, resolution and caching, role and user operations — see [permissions.md](permissions.md) |
| `app/api/admin/**` | The portal's own endpoints, gated by `withPermission` |
| `prisma/seed.ts` | Reconciles the permission table with the code |
| `lib/license-key.ts` | Key generation and normalisation |
| `lib/rate-limit.ts` | Redis fixed-window counter for the unauthenticated actions |
| `app/onboarding/actions.ts` | The four onboarding server actions |
| `app/api/auth/[...all]/route.ts` | Better Auth's own handler |
| `proxy.ts` | Optimistic cookie gate (no database access) |

`lib/auth.ts` (ours) and `lib/auth/` (generated) both exist. TypeScript resolves
the file before the directory, so `@/lib/auth` is ours.

## The one thing not to "clean up"

`databaseHooks.user.create.before` in `lib/auth.ts` forces `banned: true`
unconditionally. Rewriting it as `user.banned ?? true` opens the approval gate
for every registration. The reasoning is in [approval.md](approval.md#the-hook-that-must-not-be-simplified).
