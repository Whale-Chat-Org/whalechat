import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect, unauthorized } from "next/navigation";
import { cache } from "react";
import { parseRoleMirror, type RoleKey } from "@/lib/access";
import { auth } from "@/lib/auth";
import { resolvePermissions } from "@/lib/rbac/resolve";
import type { Permission } from "@/lib/rbac/statements";

/**
 * The Data Access Layer: who is asking, and what they may do.
 *
 * @remarks Authorization lives here rather than at the call sites that need it.
 * A check written next to the render is a check that can be forgotten on the
 * next page; a check inside the function that loads the data cannot be. This is
 * the pattern Next's own data-security guide prescribes, and the reason
 * everything below returns a minimal DTO rather than a Prisma row.
 *
 * `import "server-only"` at the top turns an accidental import from a client
 * component into a build error instead of a leaked session. Next aliases that
 * specifier itself — there is no package to install.
 */

/** The signed-in user, reduced to what an authorization decision needs. */
export interface Viewer {
  id: string;
  name: string;
  email: string;
  /** Role keys from the session's mirror — for display, never for a decision. */
  roleKeys: RoleKey[];
  permissions: Set<Permission>;
}

/**
 * The current viewer, or `null` when nobody is signed in.
 *
 * @remarks Wrapped in React's `cache()`, so a page that gates a layout, a page
 * and three components resolves the session and the permission set exactly once
 * per request instead of five times. The memo is per-request and never shared
 * between users.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roleKeys: parseRoleMirror(session.user.role),
    permissions: await resolvePermissions(session.user.id),
  };
});

/**
 * True when the viewer holds every listed permission.
 *
 * @remarks Conjunctive: passing two permissions asks for both. Asking for
 * nothing returns `false` rather than vacuously `true`, so a guard that lost its
 * arguments to a refactor denies instead of admitting everyone.
 */
export async function can(...required: Permission[]): Promise<boolean> {
  if (required.length === 0) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  return required.every((permission) => viewer.permissions.has(permission));
}

/** True when the viewer holds at least one of the listed permissions. */
export async function canAny(...required: Permission[]): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;

  return required.some((permission) => viewer.permissions.has(permission));
}

/**
 * The viewer, or send them to sign in.
 *
 * @remarks `redirectTo` is not optional decoration. Reaching a gated page with
 * no session is almost always a cookie outliving its session — Redis holds
 * sessions with persistence off — and that user wants to land back where they
 * were aiming. `unauthorized()` renders a 401 but loses the destination, so it
 * is the fallback for callers with nowhere sensible to return to.
 */
export async function requireViewer(options?: {
  redirectTo?: string;
}): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;

  if (options?.redirectTo) {
    redirect(
      `/auth/sign-in?redirectTo=${encodeURIComponent(options.redirectTo)}`
    );
  }

  unauthorized();
}

/**
 * The viewer, or a 403 page.
 *
 * @remarks `forbidden()` throws, so it has to be awaited on the render path —
 * left in an un-awaited promise it throws where nothing catches it and no UI
 * renders at all. Never wrap a call to this in `try/catch`; that swallows the
 * interrupt.
 *
 * Check before streaming starts. Moving this inside a `<Suspense>` boundary
 * still shows the 403 UI, but the response has already committed as a 200 and
 * the status cannot be changed after that.
 */
export async function requirePermission(
  ...required: Permission[]
): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!required.every((permission) => viewer.permissions.has(permission))) {
    forbidden();
  }

  return viewer;
}
