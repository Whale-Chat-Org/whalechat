"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/rbac/Can";
import { UserRolesDialog } from "@/components/rbac/UserRolesDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { PENDING_APPROVAL_REASON } from "@/lib/access";
import { request, type AdminUser, type RunAction } from "@/lib/admin";
import { authClient } from "@/lib/auth-client";

interface UserRowProps {
  user: AdminUser;
  /** Disables the actions an administrator must not aim at themselves. */
  isSelf: boolean;
  /** True while any row's action is in flight, so the table cannot be raced. */
  busy: boolean;
  run: RunAction;
}

/**
 * Three states, all read off the one `banned` column the admin plugin owns:
 * never approved, approved, or approved-then-revoked. The ban reason is what
 * separates the first from the third.
 */
function status(user: AdminUser) {
  if (!user.banned) return { label: "Active", variant: "secondary" as const };
  if (user.banReason === PENDING_APPROVAL_REASON) {
    return { label: "Pending", variant: "outline" as const };
  }
  return { label: "Revoked", variant: "destructive" as const };
}

/**
 * One account: who they are, their status and roles, and the actions on them.
 *
 * @remarks Every action here goes to `/api/admin/*`, which is ours, rather than
 * to Better Auth's admin endpoints. Those resolve permissions against a role map
 * fixed at boot and cannot see anything in `auth_role`, so a custom role would
 * be refused by them however it was granted.
 *
 * Impersonation is the exception and stays on the plugin: it signs you in as
 * someone else by setting a cookie on the response, which only the auth handler
 * can do.
 *
 * The `isSelf` and `<Can>` guards are cosmetic. `withPermission` and the
 * refusals in `lib/rbac/users.ts` are what actually hold.
 */
export function UserRow({ user, isSelf, busy, run }: UserRowProps) {
  const router = useRouter();
  const [rolesOpen, setRolesOpen] = useState(false);
  const state = status(user);
  const pending = user.banned && user.banReason === PENDING_APPROVAL_REASON;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{user.name || "—"}</div>
        <div className="text-muted-foreground text-sm">{user.email}</div>
        {!user.emailVerified && (
          <div className="text-muted-foreground mt-1 text-xs">
            Email not confirmed
          </div>
        )}
      </TableCell>

      <TableCell>
        <Badge variant={state.variant}>{state.label}</Badge>
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-muted-foreground text-sm">—</span>
          ) : (
            user.roles.map((role) => (
              <Badge key={role.key} variant="outline">
                {role.name}
              </Badge>
            ))
          )}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={busy}>
              <MoreHorizontal />
              <span className="sr-only">Actions for {user.email}</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <Can permission="role:assign">
              <DropdownMenuItem
                disabled={isSelf}
                onSelect={() => setRolesOpen(true)}
              >
                Manage roles
              </DropdownMenuItem>
            </Can>

            <Can permission="user:ban">
              {user.banned ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run({
                      action: () =>
                        request(`/api/admin/users/${user.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ allowed: true }),
                        }),
                      success: `${user.email} can now sign in`,
                    })
                  }
                >
                  {pending ? "Approve" : "Restore access"}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={isSelf}
                  onSelect={() =>
                    run({
                      action: () =>
                        request(`/api/admin/users/${user.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ allowed: false }),
                        }),
                      success: `${user.email} can no longer sign in`,
                    })
                  }
                >
                  Revoke access
                </DropdownMenuItem>
              )}
            </Can>

            <Can permission="session:revoke">
              <DropdownMenuItem
                onSelect={() =>
                  run({
                    action: () =>
                      request(`/api/admin/users/${user.id}/sessions`, {
                        method: "DELETE",
                      }),
                    success: `Signed ${user.email} out everywhere`,
                  })
                }
              >
                Sign out everywhere
              </DropdownMenuItem>
            </Can>

            <Can permission="user:impersonate">
              <DropdownMenuItem
                // Impersonation creates a session, and the ban check runs on
                // session creation — so it cannot work until the user is approved.
                disabled={isSelf || Boolean(user.banned)}
                onSelect={async () => {
                  const { error } = await authClient.admin.impersonateUser({
                    userId: user.id,
                  });
                  if (error) return;
                  router.push("/");
                  router.refresh();
                }}
              >
                Impersonate
              </DropdownMenuItem>
            </Can>

            <Can permission="user:delete">
              <DropdownMenuSeparator />

              <DropdownMenuItem
                variant="destructive"
                disabled={isSelf}
                onSelect={() =>
                  run({
                    action: () =>
                      request(`/api/admin/users/${user.id}`, {
                        method: "DELETE",
                      }),
                    success: `Deleted ${user.email}`,
                  })
                }
              >
                Delete user
              </DropdownMenuItem>
            </Can>
          </DropdownMenuContent>
        </DropdownMenu>

        <UserRolesDialog
          user={user}
          open={rolesOpen}
          onOpenChange={setRolesOpen}
          run={run}
        />
      </TableCell>
    </TableRow>
  );
}
