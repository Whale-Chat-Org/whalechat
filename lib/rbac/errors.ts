/**
 * A refusal from the RBAC layer, carrying the status a route handler should
 * answer with.
 *
 * @remarks Its own module, with no imports at all, so the operations in
 * `lib/rbac/roles.ts` and `lib/rbac/users.ts`, the handlers that call them and
 * the tests that cover them can all share it. An earlier version imported
 * `errorResponse` from `lib/api-server.ts` and quietly pulled the whole Data
 * Access Layer — and its `server-only` guard — into anything that touched an
 * error. Turning a response helper into it is `rbacErrorResponse`'s job, and
 * that lives next to the other response helpers.
 *
 * These messages are written to be read by an administrator — "you cannot grant
 * permissions you do not hold: role:delete" rather than "forbidden" — because
 * every one of them describes a rule they can act on. That is safe here in a way
 * it would not be on a public endpoint: reaching one already required passing
 * `withPermission`.
 */
export class RbacError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "RbacError";
  }
}
