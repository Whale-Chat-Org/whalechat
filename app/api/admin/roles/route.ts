import {
  errorResponse,
  rbacErrorResponse,
  readJson,
  withPermission,
} from "@/lib/api-server";
import { createRole, listRoles } from "@/lib/rbac/roles";
import { isPermission, type Permission } from "@/lib/rbac/statements";

/** Every role, with its grants and how many people hold it. */
export const GET = withPermission(["role:list"], async () =>
  Response.json(await listRoles())
);

interface NewRoleBody {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

/**
 * Read the requested grants, discarding anything the code does not define.
 *
 * @remarks Unknown keys are dropped rather than rejected. They enforce nothing
 * either way, and failing the whole request over one stale checkbox would make
 * the role editor unusable straight after a permission is renamed.
 */
function readPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPermission);
}

/** Create a role granting a subset of what the caller holds. */
export const POST = withPermission(["role:create"], async (viewer, req) => {
  const body = await readJson<NewRoleBody>(req);

  const key = typeof body.key === "string" ? body.key.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!key || !name) return errorResponse("A key and a name are required.", 400);

  try {
    const id = await createRole({
      actorPermissions: viewer.permissions,
      key,
      name,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      permissions: readPermissions(body.permissions),
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return rbacErrorResponse(error);
  }
});
