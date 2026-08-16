import {
  errorResponse,
  rbacErrorResponse,
  readJson,
  withPermission,
  type RouteContext,
} from "@/lib/api-server";
import { setUserRoles } from "@/lib/rbac/roles";

type Params = RouteContext<{ userId: string }>;

/**
 * Replace the roles a user holds.
 *
 * @remarks A `PUT` of the whole set, not add-and-remove. The dialog edits a
 * checkbox list, and one authoritative write cannot interleave with another
 * administrator's edit to leave a half-applied result.
 *
 * The refusals live in `setUserRoles`, inside the transaction: no assigning to
 * yourself, and no handing out a role that grants more than you hold.
 */
export const PUT = withPermission<Params>(
  ["role:assign"],
  async (viewer, req, { params }) => {
    const { userId } = await params;
    const body = await readJson<{ roleKeys: string[] }>(req);

    if (!Array.isArray(body.roleKeys)) {
      return errorResponse("`roleKeys` must be an array.", 400);
    }

    try {
      const keys = await setUserRoles({
        actorId: viewer.id,
        actorPermissions: viewer.permissions,
        targetUserId: userId,
        roleKeys: body.roleKeys.filter(
          (key): key is string => typeof key === "string"
        ),
      });

      return Response.json(keys);
    } catch (error) {
      return rbacErrorResponse(error);
    }
  }
);
