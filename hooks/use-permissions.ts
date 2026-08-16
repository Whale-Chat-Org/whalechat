"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchViewerPermissions, viewerPermissionsKey } from "@/lib/admin";
import type { Permission } from "@/lib/rbac/statements";

/**
 * What the signed-in user is allowed to do, for deciding what to render.
 *
 * @remarks Cosmetic, always. This decides whether a button is drawn; the route
 * handler behind that button re-resolves the same permissions from Postgres and
 * is what actually refuses. Treating this as the gate would put the decision in
 * the browser, where the person being checked can edit it.
 *
 * Server pages prefetch {@link viewerPermissionsKey} into the request's
 * `QueryClient` and hydrate it, so the first paint already knows the answer
 * instead of flashing the wrong affordances.
 */
export function usePermissions() {
  const { data, isPending } = useQuery({
    queryKey: viewerPermissionsKey,
    queryFn: fetchViewerPermissions,
  });

  const held = new Set(data ?? []);

  return {
    /** True when every listed permission is held. */
    can: (...required: Permission[]) =>
      required.length > 0 && required.every((p) => held.has(p)),
    /** True when at least one listed permission is held. */
    canAny: (...required: Permission[]) => required.some((p) => held.has(p)),
    /** True until the set has loaded — render nothing rather than guessing. */
    isPending,
  };
}
