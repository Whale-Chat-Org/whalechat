import {
  rbacErrorResponse,
  withPermission,
  type RouteContext,
} from "@/lib/api-server";
import { revokeUserSessions } from "@/lib/rbac/users";

type Params = RouteContext<{ userId: string }>;

/** Sign a user out of every device. */
export const DELETE = withPermission<Params>(
  ["session:revoke"],
  async (_viewer, _req, { params }) => {
    const { userId } = await params;

    try {
      await revokeUserSessions(userId);
      return new Response(null, { status: 204 });
    } catch (error) {
      return rbacErrorResponse(error);
    }
  }
);
