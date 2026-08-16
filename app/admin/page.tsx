import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { viewerPermissionsKey } from "@/lib/admin";
import { requireOnboarded } from "@/lib/onboarding";
import { requirePermission, requireViewer } from "@/lib/rbac/dal";
import { getServerSession } from "@/lib/session";

export const metadata: Metadata = { title: "Users · WhaleChat" };

/**
 * The users screen.
 *
 * @remarks This is the real authorization boundary. `proxy.ts` cannot help —
 * Next's proxy runs without access to the database, so it can only tell whether
 * *a* session cookie exists, never whose or what it grants. The sidebar link and
 * the tab above are decoration; these two calls are the gate.
 *
 * Gated on a permission rather than a role, so a custom role granting
 * `user:list` opens this page without having to be named "admin".
 */
export default async function AdminPage() {
  await requireOnboarded();

  // Session first, so a stale cookie lands back here after signing in rather
  // than on a 401 with nowhere to go.
  const viewer = await requireViewer({ redirectTo: "/admin" });

  // Then the permission, which renders `app/forbidden.tsx` with a real 403.
  // Both calls share one resolution — `getViewer` is memoized per request.
  //
  // Note it checks *before* anything streams. Wrapping the content below in
  // `<Suspense>`, or adding an `app/admin/loading.tsx`, would commit the
  // response as a 200 first and the status could no longer be changed.
  await requirePermission("user:list");

  const { queryClient } = await getServerSession();

  // Seeded server-side so `<Can>` renders the right affordances on first paint
  // instead of flashing buttons in as the permission set arrives. Set from the
  // viewer we already resolved rather than fetched: the browser fetcher aims at
  // a relative URL with the caller's cookies, neither of which exists here. Same
  // reason `app/page.tsx` prefetches chats through `listChats` instead of
  // `/api/chats`.
  queryClient.setQueryData(viewerPermissionsKey, [...viewer.permissions].sort());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div>
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          New sign-ups wait here until you approve them.
        </p>

        <AdminUsers currentUserId={viewer.id} />
      </div>
    </HydrationBoundary>
  );
}
