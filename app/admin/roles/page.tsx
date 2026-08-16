import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { RolesTable } from "@/components/rbac/RolesTable";
import { adminRolesKey, viewerPermissionsKey } from "@/lib/admin";
import { requireOnboarded } from "@/lib/onboarding";
import { requirePermission, requireViewer } from "@/lib/rbac/dal";
import { listRoles } from "@/lib/rbac/roles";
import { getServerSession } from "@/lib/session";

export const metadata: Metadata = { title: "Roles · WhaleChat" };

/**
 * The roles screen.
 *
 * @remarks Gates itself rather than relying on `app/admin/layout.tsx`. A layout
 * does not re-run when the user navigates between the pages under it, so a check
 * placed there would be skipped on exactly the navigation it needed to catch.
 */
export default async function AdminRolesPage() {
  await requireOnboarded();

  const viewer = await requireViewer({ redirectTo: "/admin/roles" });
  await requirePermission("role:list");

  const { queryClient } = await getServerSession();

  // Both seeded from the server, so the table and its `<Can>`-gated buttons
  // render complete on first paint. `listRoles` is the data layer directly —
  // no HTTP hop back into our own route, matching `app/page.tsx`.
  await queryClient.prefetchQuery({
    queryKey: adminRolesKey,
    queryFn: listRoles,
  });
  queryClient.setQueryData(viewerPermissionsKey, [...viewer.permissions].sort());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div>
        <h2 className="text-lg font-semibold">Roles</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          A role is a named bundle of permissions. Users can hold more than one,
          and get everything their roles grant added together.
        </p>

        <RolesTable />
      </div>
    </HydrationBoundary>
  );
}
