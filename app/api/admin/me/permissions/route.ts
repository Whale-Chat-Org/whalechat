import { withUser } from "@/lib/api-server";
import { resolvePermissions } from "@/lib/rbac/resolve";

/**
 * The permissions the caller holds.
 *
 * @remarks Self-scoped, so it needs no permission of its own — the answer is
 * derived from the session and cannot be pointed at anyone else. It exists
 * because `authClient.admin.checkRolePermission` cannot serve this: that check
 * runs against a role map assembled in the browser bundle at module load, and a
 * role created at runtime is not in it.
 *
 * What comes back drives `<Can>` and nothing else. Hiding a button is not a
 * security boundary; the handler behind it re-resolves this from Postgres.
 */
export const GET = withUser(async (userId) =>
  Response.json([...(await resolvePermissions(userId))].sort())
);
