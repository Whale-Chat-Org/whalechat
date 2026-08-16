import {
  errorResponse,
  rbacErrorResponse,
  readJson,
  withPermission,
  type RouteContext,
} from "@/lib/api-server";
import { deleteAdminUser, setUserAccess } from "@/lib/rbac/users";

type Params = RouteContext<{ userId: string }>;

/**
 * Approve or revoke an account.
 *
 * @remarks `allowed` rather than `banned`, so the request says what it wants
 * rather than what it sets. The ban reason that distinguishes "never approved"
 * from "revoked" is the server's to choose; a client that could name it could
 * disguise a revocation as a pending account.
 */
export const PATCH = withPermission<Params>(
  ["user:ban"],
  async (viewer, req, { params }) => {
    const { userId } = await params;
    const body = await readJson<{ allowed: boolean }>(req);

    if (typeof body.allowed !== "boolean") {
      return errorResponse("`allowed` must be true or false.", 400);
    }

    try {
      await setUserAccess({
        actorId: viewer.id,
        targetUserId: userId,
        allowed: body.allowed,
      });

      return new Response(null, { status: 204 });
    } catch (error) {
      return rbacErrorResponse(error);
    }
  }
);

/** Delete an account, and by cascade its sessions, chats and role rows. */
export const DELETE = withPermission<Params>(
  ["user:delete"],
  async (viewer, _req, { params }) => {
    const { userId } = await params;

    try {
      await deleteAdminUser({ actorId: viewer.id, targetUserId: userId });
      return new Response(null, { status: 204 });
    } catch (error) {
      return rbacErrorResponse(error);
    }
  }
);
