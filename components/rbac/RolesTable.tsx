"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Can } from "@/components/rbac/Can";
import { RoleDialog } from "@/components/rbac/RoleDialog";
import { RoleRow } from "@/components/rbac/RoleRow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminRolesKey,
  adminUsersKey,
  fetchAdminRoles,
  viewerPermissionsKey,
  type AdminAction,
} from "@/lib/admin";

/**
 * The roles table: what exists, what each grants, and who holds it.
 *
 * @remarks Same shape as the users table — raw `<Table>` primitives and one
 * shared `run()` that reports and invalidates — so the two screens stay legible
 * as one portal rather than two.
 */
export function RolesTable() {
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: roles, isPending, error } = useQuery({
    queryKey: adminRolesKey,
    queryFn: fetchAdminRoles,
  });

  const { mutate: run, isPending: isMutating } = useMutation({
    mutationFn: async ({ action }: AdminAction) => action(),
    onSuccess: (_result, { success }) => {
      toast.success(success);
      queryClient.invalidateQueries({ queryKey: adminRolesKey });
      // A grant edit can change what the editor themselves may do — including
      // taking away the button they just used — so their own permissions are
      // refetched too.
      queryClient.invalidateQueries({ queryKey: viewerPermissionsKey });
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-destructive py-16 text-center text-sm">
        Could not load roles: {error.message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Can permission="role:create">
        <div className="flex">
          <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus />
            New role
          </Button>
        </div>
      </Can>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="w-32">Permissions</TableHead>
              <TableHead className="w-24">Holders</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {(roles ?? []).map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                busy={isMutating}
                run={run}
              />
            ))}

            {(roles ?? []).length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground h-24 text-center"
                >
                  No roles yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {creating && (
        <RoleDialog open={creating} onOpenChange={setCreating} run={run} />
      )}
    </div>
  );
}
