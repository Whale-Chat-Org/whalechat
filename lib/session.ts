import { ensureSession } from "@better-auth-ui/react/server";
import { headers } from "next/headers";
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

/** True when the session belongs to an administrator. */
export function isAdmin(session: { user: { role?: string | null } } | null) {
  return session?.user.role === "admin";
}
