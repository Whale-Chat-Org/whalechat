/**
 * The admin portal's shared vocabulary: query keys, the shapes the screens
 * exchange, and the one fetch helper they all go through.
 *
 * @remarks It lives here rather than in `AdminUsers.tsx` because the table, the
 * row and the create dialog all need it — importing it from the table left the
 * dialog and the table importing each other. Same reasoning as the chat keys in
 * `lib/chat-api.ts`, and the same reason the keys are in a module with no
 * `"use client"`: server components prefetch into them.
 *
 * Everything here talks to `/api/admin/*`, which is ours. Better Auth's own
 * admin endpoints are not used for authorization-bearing work: they resolve
 * permissions against a role map built at boot and cannot see the roles in
 * `auth_role`, so a custom role would be refused by them no matter what it
 * grants. Impersonation is the one exception, and it stays on the plugin
 * because it has to set a cookie on the browser's response.
 */

import type { Permission } from "@/lib/rbac/statements";

/** Query key the users table reads, and every mutation invalidates once it lands. */
export const adminUsersKey = ["admin", "users"] as const;

/** Query key for the role list. */
export const adminRolesKey = ["admin", "roles"] as const;

/** Query key for the signed-in user's own resolved permissions. */
export const viewerPermissionsKey = ["admin", "me", "permissions"] as const;

/** A role as it appears on a user's row. */
export interface AdminUserRole {
  key: string;
  name: string;
}

/** A user, as the admin portal shows them. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: string | Date;
  roles: AdminUserRole[];
}

/** A role, with what it grants and how many people hold it. */
export interface AdminRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** Built-in roles cannot be renamed, rekeyed or deleted. */
  system: boolean;
  permissions: Permission[];
  userCount: number;
}

/**
 * One admin call, paired with what to say when it works.
 *
 * @remarks The call is passed in unresolved so the wrapper decides what a
 * failure means. Unlike the Better Auth client it replaced, `request` throws on
 * a refusal rather than returning `{ error }`, so there is nothing to unwrap.
 */
export interface AdminAction {
  action: () => Promise<unknown>;
  success: string;
}

/** Runs an {@link AdminAction}, reports it, and refetches. */
export type RunAction = (args: AdminAction) => void;

/**
 * Call an admin endpoint.
 *
 * @throws With the server's `error` message when the response is not OK — the
 * same `{ error }` envelope `errorResponse` writes, so a 403 surfaces the
 * refusal rather than a generic failure.
 */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Request failed");
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

/** The permissions the signed-in user holds. */
export function fetchViewerPermissions() {
  return request<Permission[]>("/api/admin/me/permissions");
}

/** Every user, most recently created first. */
export function fetchAdminUsers() {
  return request<AdminUser[]>("/api/admin/users");
}

/** Every role, with its grants. */
export function fetchAdminRoles() {
  return request<AdminRole[]>("/api/admin/roles");
}
