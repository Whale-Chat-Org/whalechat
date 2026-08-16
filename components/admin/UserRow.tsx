"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  PENDING_APPROVAL_REASON,
  REVOKED_REASON,
  type Role,
} from "@/lib/access";
import type { AdminUser, RunAction } from "@/lib/admin";
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

/** One account: who they are, their status and role, and the actions on them. */
export function UserRow({ user, isSelf, busy, run }: UserRowProps) {
  const router = useRouter();
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
        <Select
          value={user.role ?? "user"}
          disabled={busy || isSelf}
          onValueChange={(value) => {
            const role = value as Role;
            run({
              action: () => authClient.admin.setRole({ userId: user.id, role }),
              success: `${user.email} is now ${role}`,
            });
          }}
        >
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
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
            {user.banned ? (
              <DropdownMenuItem
                onSelect={() =>
                  run({
                    action: () =>
                      authClient.admin.unbanUser({ userId: user.id }),
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
                      authClient.admin.banUser({
                        userId: user.id,
                        banReason: REVOKED_REASON,
                      }),
                    success: `${user.email} can no longer sign in`,
                  })
                }
              >
                Revoke access
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              disabled={isSelf}
              onSelect={() =>
                run({
                  action: () =>
                    authClient.admin.revokeUserSessions({ userId: user.id }),
                  success: `Signed ${user.email} out everywhere`,
                })
              }
            >
              Sign out everywhere
            </DropdownMenuItem>

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

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onSelect={() =>
                run({
                  action: () =>
                    authClient.admin.removeUser({ userId: user.id }),
                  success: `Deleted ${user.email}`,
                })
              }
            >
              Delete user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
