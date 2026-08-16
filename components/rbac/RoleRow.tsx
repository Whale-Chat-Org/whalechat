"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/rbac/Can";
import { RoleDialog } from "@/components/rbac/RoleDialog";
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
import { BUILTIN_ROLES } from "@/lib/access";
import { request, type AdminRole, type RunAction } from "@/lib/admin";

interface RoleRowProps {
  role: AdminRole;
  /** True while any row's action is in flight, so the table cannot be raced. */
  busy: boolean;
  run: RunAction;
}

/**
 * One role: what it grants, how many people hold it, and the actions on it.
 *
 * @remarks Built-in roles cannot be deleted, and `admin` cannot be edited at
 * all — it holds every permission by definition and the seed re-grants them on
 * the next run regardless. Both refusals are repeated server-side in
 * `lib/rbac/roles.ts`; the disabled items here only save a round trip.
 */
export function RoleRow({ role, busy, run }: RoleRowProps) {
  const [editing, setEditing] = useState(false);
  const isAdminRole = role.key === BUILTIN_ROLES.admin;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{role.name}</span>
          {role.system && <Badge variant="outline">Built-in</Badge>}
        </div>
        <div className="text-muted-foreground text-sm">
          {role.description ?? role.key}
        </div>
      </TableCell>

      <TableCell className="text-muted-foreground text-sm">
        {role.permissions.length}
      </TableCell>

      <TableCell className="text-muted-foreground text-sm">
        {role.userCount}
      </TableCell>

      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={busy}>
              <MoreHorizontal />
              <span className="sr-only">Actions for {role.name}</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <Can permission="role:update">
              <DropdownMenuItem
                disabled={isAdminRole}
                onSelect={() => setEditing(true)}
              >
                Edit role
              </DropdownMenuItem>
            </Can>

            <Can permission="role:delete">
              <DropdownMenuSeparator />

              <DropdownMenuItem
                variant="destructive"
                disabled={role.system}
                onSelect={() =>
                  run({
                    action: () =>
                      request(`/api/admin/roles/${role.id}`, {
                        method: "DELETE",
                      }),
                    success: `Deleted ${role.name}`,
                  })
                }
              >
                Delete role
              </DropdownMenuItem>
            </Can>
          </DropdownMenuContent>
        </DropdownMenu>

        {editing && (
          <RoleDialog
            role={role}
            open={editing}
            onOpenChange={setEditing}
            run={run}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
