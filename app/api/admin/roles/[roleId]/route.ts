import {
  errorResponse,
  rbacErrorResponse,
  readJson,
  withPermission,
  type RouteContext,
} from "@/lib/api-server";
import { deleteRole, updateRole } from "@/lib/rbac/roles";
import { isPermission, type Permission } from "@/lib/rbac/statements";

type Params = RouteContext<{ roleId: string }>;

interface RolePatchBody {
  name: string;
  description: string;
  permissions: string[];
}

function readPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPermission);
}

/**
 * Rename a role and replace its grants.
 *
 * @remarks The key is not patchable. It is what `User.role` mirrors and what
 * `lib/auth.ts`, `lib/onboarding.ts` and the seed compare against, so changing
 * it would have to rewrite every mirror at the same instant.
 */
export const PATCH = withPermission<Params>(
  ["role:update"],
  async (viewer, req, { params }) => {
    const { roleId } = await params;
    const body = await readJson<RolePatchBody>(req);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return errorResponse("A name is required.", 400);

    try {
      await updateRole({
        actorPermissions: viewer.permissions,
        roleId,
        name,
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : null,
        permissions: readPermissions(body.permissions),
      });

      return new Response(null, { status: 204 });
    } catch (error) {
      return rbacErrorResponse(error);
    }
  }
);

/** Delete a role, and every assignment of it. */
export const DELETE = withPermission<Params>(
  ["role:delete"],
  async (_viewer, _req, { params }) => {
    const { roleId } = await params;

    try {
      await deleteRole({ roleId });
      return new Response(null, { status: 204 });
    } catch (error) {
      return rbacErrorResponse(error);
    }
  }
);
