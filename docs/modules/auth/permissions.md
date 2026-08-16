# Permissions and roles

Authorization is ours. Better Auth handles authentication — who you are, and the
session that proves it — and nothing else.

**Permissions are code.** `lib/rbac/statements.ts` is a closed set of
`resource:action` strings. A permission is only real if something checks it, and
the things that check it are route handlers and pages, so the vocabulary lives
next to them.

**Roles are data.** `auth_role` rows grant subsets of that set, so a new role is
an administrator's decision rather than a deploy. A user holds any number of
them through `user_role`, and gets everything their roles grant, added together.
There is no deny rule and no precedence — a permission is held or it is not.

## Why Better Auth's admin plugin does not do this

Its `hasPermission` is **synchronous**:

```js
const acRoles = input.options?.roles || defaultRoles;
for (const role of roles) if (acRoles[role]?.authorize(input.permissions)?.success) return true;
```

That map is assembled when `betterAuth()` is called. There is no `await`
anywhere in the path, so a role that lives in Postgres can never be resolved
inside one of the plugin's endpoints — a custom role granting `user:list` would
still be refused by `admin.listUsers`, whatever the database says.

So the portal's operations moved to `app/api/admin/**`, which resolve
permissions asynchronously from Postgres. See
[admin-portal.md](admin-portal.md).

**Impersonation is the one exception.** It signs you in as someone else by
setting a cookie on the response, which only the auth handler can do, so it
stays on `authClient.admin.impersonateUser` and stays gated on the built-in
`admin` role.

## `User.role` is a mirror

`user_role` is the source of truth. `User.role` holds the same role keys —
sorted, comma-joined, `"admin,support"` — and exists only so Better Auth's plugin
can still authorize impersonation and so the session carries something to
display.

Only `lib/rbac/roles.ts` writes it, and it writes through
`auth.$context.internalAdapter.updateUser`, never `prisma.user.update`. Sessions
live in Redis and **each cached session carries a copy of the user object**. The
internal adapter calls `refreshUserSessions`, which rewrites that copy in every
live session; a direct Prisma write does not, so the old roles would keep being
reported for up to the session's seven days.

**Never compare that column with `=`.** A user holding two roles has
`"admin,support"` in it, and `role = 'admin'` misses them. Use `hasRoleKey`
(`lib/access.ts`) in TypeScript and join through `user_role` in Prisma — which
is what `lib/onboarding.ts` now does.

The one moment the mirror leads is account creation: the plugin stamps `role`
before any row exists, and the `user.create.after` hook in `lib/auth.ts` turns
that stamp into `user_role` rows. Without it the first administrator would have
a mirror with nothing behind it, and the next rebuild would silently demote them.

## Resolving a permission

```
getViewer()  ──► React cache()   one resolution per request
     │
     ├── auth.api.getSession        Redis, then Postgres
     └── resolvePermissions(userId)
              │
              ├── whalechat:rbac:version                 Redis, 10s
              └── whalechat:rbac:v<version>:perms:<uid>   Redis, 300s
                        └── miss ──► Postgres
```

**A cache problem is never a verdict.** Every Redis call in `lib/rbac/resolve.ts`
is wrapped so that a miss, a null, an unparseable entry or a thrown connection
error all fall through to Postgres. There is deliberately no branch returning an
empty set on failure: that would lock the only administrator out of their own
instance the first time Redis restarted.

**Invalidation is a version bump, not a fan-out.** Every write to a role, a grant
or an assignment increments `access_version` inside the same transaction. One
increment moves every reader to a namespace with nothing in it; the abandoned
keys expire on their own TTL. Editing a role's grants changes what everyone
holding it can do, and enumerating those holders to delete their keys is both an
extra query and a race — a resolution already in flight can write the old set
back in after the delete.

That counter lives in **Postgres, not Redis**. Redis here runs without
persistence, and a counter that resets to zero would let keys from an earlier
epoch be read as current, resurrecting a revoked grant.

## Enforcement

| Layer | Mechanism | Notes |
|---|---|---|
| `proxy.ts` | cookie presence | No database access. Cannot see roles. Unchanged. |
| Server components | `requirePermission()` → `forbidden()` | Real 403 via `app/forbidden.tsx` |
| Route handlers | `withPermission()` → 403 JSON | The gate for `/api/admin/**` |
| Client | `<Can>` / `usePermissions()` | **Cosmetic.** Hides buttons, refuses nothing. |

`forbidden()` and `unauthorized()` need `experimental.authInterrupts` in
`next.config.ts`. It is on.

Check **before anything streams**. Putting a gate inside a `<Suspense>` boundary
still shows the 403 UI, but the response has already committed as a 200 and the
status can no longer change — which is why there is no `app/admin/loading.tsx`.

`app/admin/layout.tsx` checks nothing. **A layout is not an authorization
boundary**: it does not re-run when the user navigates between the pages under
it, so each page repeats its own gate.

## Escalation, and where each attempt is refused

| Attempt | Refused by |
|---|---|
| Grant a role a permission you do not hold | `filterGrantablePermissions`, inside `createRole` / `updateRole` / `setUserRoles`. Without it, `role:create` quietly means *every* permission. |
| Assign yourself a role | `setUserRoles` — the `isSelf` guards in the table are the cosmetic half |
| Compose a role for a confederate that outranks you | `setUserRoles` intersects the role's grants against yours before assigning |
| Edit or delete a built-in role | `AuthRole.system`. `admin` additionally cannot be edited — it holds everything by definition. |
| Leave nobody able to manage roles | A count of non-banned `role:assign` holders, run *inside* the transaction after the write. Same reasoning as onboarding's refusal to reopen the claim. |
| Ban or delete yourself | `lib/rbac/users.ts`. Better Auth's own `YOU_CANNOT_BAN_YOURSELF` no longer runs, so this is re-implemented rather than inherited. |
| Call `/api/admin/**` directly | `withPermission`. `proxy.ts` only proves a cookie exists. |
| Use a stale grant after revocation | The version bump, and the reason permissions are not baked into the session cookie |

**`session.cookieCache` must stay off**, and `lib/auth.ts` must keep having no
`session` block. It would put a signed copy of the session in the cookie for its
lifetime, so a revoked grant — and a ban — would keep working until it expired.

## Seeding

`npm run db:seed` reconciles `auth_permission` against `ALL_PERMISSIONS` and
upserts the two built-in roles. Idempotent, keyed on `key`, safe on every deploy.

`admin` is re-granted **every** permission on each run: a permission added in
code must not leave the only administrator unable to use the feature it guards.
`user` is created empty and then left alone, because granting it something is a
legitimate choice the seed must not keep reverting.

A permission in the database that code no longer defines is **reported, not
deleted** — deleting cascades away grants an administrator made deliberately, and
a rename looks exactly like a removal from there. `npm run db:seed -- --prune`
removes them on purpose. Either way `resolvePermissions` filters them out, so
they grant nothing while they sit there.

## Where the code is

| Path | Role |
|---|---|
| `lib/rbac/statements.ts` | The closed permission set; client-safe, no imports |
| `lib/rbac/dal.ts` | `getViewer`, `can`, `requireViewer`, `requirePermission` |
| `lib/rbac/resolve.ts` | Permission resolution, the Redis cache, the version bump |
| `lib/rbac/roles.ts` | Role CRUD, assignments, and the only writer of `User.role` |
| `lib/rbac/users.ts` | User administration, replacing the plugin's endpoints |
| `lib/rbac/errors.ts` | `RbacError`; no imports, so anything can throw one |
| `lib/access.ts` | Ban reasons, built-in role keys, the mirror codec |
| `lib/admin.ts` | Query keys, DTOs and the one fetch helper the screens share |
| `hooks/use-permissions.ts`, `components/rbac/Can.tsx` | The cosmetic client seam |
| `prisma/seed.ts` | Reconciles the tables with the code |
