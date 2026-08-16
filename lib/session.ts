import { ensureSession } from "@better-auth-ui/react/server";
import { headers } from "next/headers";
import { BUILTIN_ROLES, hasRoleKey } from "@/lib/access";
import { auth } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";

/**
 * Resolve the session inside a server component, and prime the client cache.
 *
 * @remarks Calls `auth.api` directly — no HTTP hop back into our own route — and
 * writes the result into a per-request `QueryClient`. Pair the returned client
 * with `<HydrationBoundary state={dehydrate(queryClient)}>` so `useSession` in
 * the tree below renders straight from cache instead of flashing a loading state.
 */
export async function getServerSession() {
  const queryClient = getQueryClient();
  const session = await ensureSession(queryClient, auth, {
    headers: await headers(),
  });

  return { queryClient, session };
}

/**
 * True when the session carries the built-in `admin` role.
 *
 * @remarks Answers "would Better Auth's admin plugin let you through", which is
 * a narrower question than "may you do X" — the plugin authorizes its own
 * endpoints against this role key and knows nothing about the roles in
 * `auth_role`. For anything else, ask `can()` from `lib/rbac/dal.ts`.
 *
 * Reads the mirror through `hasRoleKey` rather than comparing it. A user holding
 * two roles has `"admin,support"` in that column, and `=== "admin"` says they
 * are not an administrator.
 */
export function isAdmin(session: { user: { role?: string | null } } | null) {
  return hasRoleKey(session?.user.role, BUILTIN_ROLES.admin);
}
