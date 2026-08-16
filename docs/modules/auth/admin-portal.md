# Admin portal

`/admin`, linked from the user menu. Two screens — Users and Roles — sharing
`app/admin/layout.tsx`. `components/admin/` and `components/rbac/` are ours, not
generated.

## It does not run on Better Auth's admin endpoints

It used to. Those endpoints resolve permissions against a role map built when
`betterAuth()` is called, and that lookup is synchronous, so they cannot see a
role that lives in Postgres — a custom role granting `user:list` would still be
refused by `admin.listUsers`. The operations moved to `app/api/admin/**`, which
resolve from the database. The reasoning is in [permissions.md](permissions.md).

**Impersonation is the exception** and stays on the plugin, because it signs you
in as someone else by setting a cookie on the response.

## What it can do

| Action | Endpoint | Permission |
|---|---|---|
| List users with their roles | `GET /api/admin/users` | `user:list` |
| Create a pre-approved user | `POST /api/admin/users` | `user:create` |
| Approve or revoke access | `PATCH /api/admin/users/[userId]` | `user:ban` |
| Delete | `DELETE /api/admin/users/[userId]` | `user:delete` |
| Replace a user's roles | `PUT /api/admin/users/[userId]/roles` | `role:assign` |
| Sign a user out everywhere | `DELETE /api/admin/users/[userId]/sessions` | `session:revoke` |
| List roles | `GET /api/admin/roles` | `role:list` |
| Create a role | `POST /api/admin/roles` | `role:create` |
| Rename a role, replace its grants | `PATCH /api/admin/roles/[roleId]` | `role:update` |
| Delete a role | `DELETE /api/admin/roles/[roleId]` | `role:delete` |
| Your own permissions | `GET /api/admin/me/permissions` | none — self-scoped |
| Impersonate | `authClient.admin.impersonateUser` | built-in `admin` role |

Every destructive or role-changing action is disabled for your own row. Those
disabled buttons are cosmetic; `lib/rbac/users.ts` and `lib/rbac/roles.ts` refuse
the same things server-side, including the `YOU_CANNOT_BAN_YOURSELF` the plugin
used to provide for free.

The Status column derives from `banned` + `banReason`; see
[approval.md](approval.md).

## Roles

A user's roles are a badge list plus a **Manage roles** dialog — checkboxes, not
a `<Select>`, because roles live in a join table and a user may hold several. The
dialog submits the whole set with `PUT`, so two administrators editing the same
user produce one winner rather than an interleaved half-state.

The role editor renders its permission matrix from `lib/rbac/statements.ts`
rather than from the `auth_permission` table: the table is a mirror the seed
keeps in step, and offering a row the code no longer defines would let someone
compose a role out of grants that do nothing.

Permissions you do not hold yourself are disabled — reinforcement for a rule
enforced server-side, since otherwise `role:create` would quietly mean every
permission.

Built-in roles (`admin`, `user`) cannot be deleted or rekeyed, and `admin`
cannot be edited at all: it holds every permission by definition, and the seed
re-grants them on the next run regardless.

## Three behaviours that look like bugs

**Creating a user takes two writes.** The account is born banned by
`databaseHooks.user.create.before`, and `POST /api/admin/users` lifts the ban
immediately afterwards. That hook cannot tell an administrator's invitation from
a self-registration, and weakening it to accommodate this one caller would open
the gate for every registration.

**Impersonating a pending user fails.** Impersonation creates a session, and the
ban is enforced on session creation — so an unapproved account cannot be
impersonated. The row disables the action rather than letting it fail as a bare
toast.

**A role key cannot be changed.** It is what `User.role` mirrors and what
`lib/auth.ts`, `lib/onboarding.ts` and the seed compare against, so renaming one
would have to rewrite every mirror in the same instant. A role that needs a
different key is a different role.

## Authorization

Each page gates itself — `requireOnboarded()`, then `requireViewer()`, then
`requirePermission()` — and renders `app/forbidden.tsx` with a real 403
otherwise. `app/admin/layout.tsx` checks nothing on purpose: a layout is not an
authorization boundary. `proxy.ts` cannot help either; it has no database access,
so it can only see that *a* cookie exists. The sidebar link and the tabs are
cosmetic.

See [authorization.md](authorization.md).

## Stop impersonating

`adminPlugin()` from `@better-auth-ui` contributes a **Stop impersonating** item
to `<UserButton />`, shown only while `session.session.impersonatedBy` is set. It
is registered in `components/providers.tsx`.
