/**
 * The admin portal's shared vocabulary: one query key, one user shape, one
 * action signature.
 *
 * @remarks It lives here rather than in `AdminUsers.tsx` because the table, the
 * row and the create dialog all need it — importing it from the table left the
 * dialog and the table importing each other. Same reasoning as the chat keys in
 * `lib/chat-api.ts`.
 */

/** Query key the users table reads, and every mutation invalidates once it lands. */
export const adminUsersKey = ["admin", "users"] as const;

/** A user as Better Auth's admin plugin reports them. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: string | Date;
}

/**
 * One admin-plugin call, paired with what to say when it works.
 *
 * @remarks Better Auth reports refusals in `error` rather than by throwing, so
 * the call is passed in unresolved and the wrapper decides what a failure means.
 */
export interface AdminAction {
  action: () => Promise<{ error?: { message?: string } | null }>;
  success: string;
}

/** Runs an {@link AdminAction}, reports it, and refetches the table. */
export type RunAction = (args: AdminAction) => void;
