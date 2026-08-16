"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import type { Permission } from "@/lib/rbac/statements";

interface CanProps {
  /** Every permission the viewer must hold for the children to render. */
  permission: Permission | Permission[];
  children: ReactNode;
  /** Shown instead when the viewer lacks it. Nothing, by default. */
  fallback?: ReactNode;
}

/**
 * Render children only when the viewer holds the permission.
 *
 * @remarks **This is decoration, not a gate.** It hides affordances that would
 * fail if clicked, which is a courtesy to the user, not a security boundary —
 * anyone can call the endpoint directly and `withPermission` is what refuses
 * them. Never use it to protect something that has no server-side check behind
 * it.
 *
 * Renders the fallback while the permission set is still loading. Erring
 * towards hidden means a slow request shows a missing button for a moment
 * rather than one that flashes in and then disappears.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can, isPending } = usePermissions();
  const required = Array.isArray(permission) ? permission : [permission];

  if (isPending || !can(...required)) return <>{fallback}</>;

  return <>{children}</>;
}
