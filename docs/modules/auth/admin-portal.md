# Admin portal

`/admin`, linked from the user menu for administrators. Built on Better Auth's
`admin()` plugin — `components/admin/` is ours, not generated.

## What it can do

| Action | Call |
|---|---|
| List, search, paginate | `admin.listUsers({ query: { limit, offset, searchValue, … } })` |
| Approve access | `admin.unbanUser({ userId })` |
| Revoke access | `admin.banUser({ userId, banReason: REVOKED_REASON })` |
| Change role | `admin.setRole({ userId, role })` — `user` or `admin` |
| Create a pre-approved user | `admin.createUser(...)` then `admin.unbanUser` |
| Delete | `admin.removeUser({ userId })` |
| Sessions | `admin.listUserSessions` / `revokeUserSession` / `revokeUserSessions` |
| Impersonate | `admin.impersonateUser({ userId })` |

Every destructive or role-changing action is disabled for your own row — the
plugin also refuses `YOU_CANNOT_BAN_YOURSELF` server-side.

The Status column derives from `banned` + `banReason`; see
[approval.md](approval.md).

## Two behaviours that look like bugs

**Creating a user takes two calls.** `admin.createUser` writes through the same
`databaseHooks.user.create.before` hook as everything else, so the new account is
born banned. The dialog immediately calls `unbanUser`. That is deliberate: the
hook forces `banned: true` unconditionally, and weakening it to accommodate this
one caller would open the gate for every registration.

**Impersonating a pending user fails.** Impersonation creates a session, and the
ban is enforced on session creation — so an unapproved account cannot be
impersonated. The row disables the action rather than letting it fail as a bare
toast.

## Authorization

Enforced in `app/admin/page.tsx`: session, then `role === "admin"`, rendering a
"Not authorised" page otherwise. `proxy.ts` cannot help — it has no database
access, so it can only see that *a* cookie exists. The sidebar link is cosmetic.

See [authorization.md](authorization.md).

## Stop impersonating

`adminPlugin()` from `@better-auth-ui` contributes a **Stop impersonating** item
to `<UserButton />`, shown only while `session.session.impersonatedBy` is set. It
is registered in `components/providers.tsx`.
