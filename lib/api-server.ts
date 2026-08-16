import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getViewer, type Viewer } from "@/lib/rbac/dal";
import { RbacError } from "@/lib/rbac/errors";
import type { Permission } from "@/lib/rbac/statements";

/** The params bag Next hands a dynamic route handler. */
export interface RouteContext<P> {
  params: Promise<P>;
}

/** JSON error envelope the client reads via `data.error`. */
export function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * The signed-in user's id, or `null`.
 *
 * @remarks This is the only acceptable source of a user id in a route handler.
 * `proxy.ts` already 401s unauthenticated `/api/*` calls, but that is an
 * unvalidated cookie check — it proves a cookie exists, not that it names a live
 * session. Anything that reads or writes a user's data needs the real one.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

/**
 * Wrap a route handler so it runs only for a caller with a live session,
 * receiving that caller's id as its first argument.
 *
 * @remarks Every chat route opens with the same check, and omitting it would
 * serve someone else's data rather than fail loudly — so it is the wrapper
 * rather than the first two lines of each handler. `/api/chat` is deliberately
 * not wrapped: it answers 503 for an instance that has not been set up *before*
 * asking who is calling, and that order is part of the response it gives.
 */
export function withUser<C = unknown>(
  handler: (userId: string, req: Request, context: C) => Promise<Response>
) {
  return async (req: Request, context: C): Promise<Response> => {
    const userId = await getSessionUserId();
    if (!userId) return errorResponse("Not authenticated", 401);

    return handler(userId, req, context);
  };
}

/**
 * Wrap a route handler so it runs only for a caller holding every listed
 * permission, receiving the resolved viewer as its first argument.
 *
 * @remarks The sibling of {@link withUser}, and the real gate for everything
 * under `/api/admin`. `<Can>` in the UI decides what to *show*; this decides
 * what happens, and it re-resolves from Postgres rather than trusting anything
 * the client sent.
 *
 * Answers with the JSON envelope rather than calling `forbidden()`. The reason
 * is the one `proxy.ts` already documents for its 401: these responses are read
 * with `response.json()`, and an HTML error page makes that throw instead of
 * surfacing the message.
 */
export function withPermission<C = unknown>(
  required: readonly Permission[],
  handler: (viewer: Viewer, req: Request, context: C) => Promise<Response>
) {
  return async (req: Request, context: C): Promise<Response> => {
    const viewer = await getViewer();
    if (!viewer) return errorResponse("Not authenticated", 401);

    const missing = required.filter(
      (permission) => !viewer.permissions.has(permission)
    );
    if (missing.length > 0) return errorResponse("Forbidden", 403);

    return handler(viewer, req, context);
  };
}

/**
 * Turn a value thrown by the RBAC layer into a response.
 *
 * @remarks An {@link RbacError} is a decision and says so, because every one of
 * those messages describes a rule the administrator reading it can act on.
 * Anything else is a bug and becomes a bare 500 — the message could name a table
 * or a constraint, and the admin portal is not the place to leak the schema.
 */
export function rbacErrorResponse(error: unknown): Response {
  if (error instanceof RbacError) {
    return errorResponse(error.message, error.status);
  }

  console.error("Unhandled RBAC failure", error);
  return errorResponse("Something went wrong", 500);
}

/** Parse a JSON body, treating malformed input as an empty object. */
export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}
