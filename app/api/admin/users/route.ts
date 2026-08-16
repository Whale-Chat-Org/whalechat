import {
  errorResponse,
  rbacErrorResponse,
  readJson,
  withPermission,
} from "@/lib/api-server";
import { createAdminUser, listAdminUsers } from "@/lib/rbac/users";

/** Every user, most recently created first, with the roles they hold. */
export const GET = withPermission(["user:list"], async () =>
  Response.json(await listAdminUsers())
);

interface NewUserBody {
  name: string;
  email: string;
  password: string;
  roleKeys: string[];
}

/**
 * Create an account that is active immediately.
 *
 * @remarks Fields are read one at a time rather than spread. Spreading the body
 * would let a caller set `banned`, or `role`, and walk straight past both the
 * approval gate and the role checks.
 */
export const POST = withPermission(
  ["user:create"],
  async (viewer, req) => {
    const body = await readJson<NewUserBody>(req);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const roleKeys = Array.isArray(body.roleKeys)
      ? body.roleKeys.filter((key): key is string => typeof key === "string")
      : [];

    if (!name || !email || !password) {
      return errorResponse("Name, email and password are all required.", 400);
    }

    try {
      const id = await createAdminUser({
        actorId: viewer.id,
        actorPermissions: viewer.permissions,
        name,
        email,
        password,
        roleKeys,
      });

      return Response.json({ id }, { status: 201 });
    } catch (error) {
      return rbacErrorResponse(error);
    }
  }
);
