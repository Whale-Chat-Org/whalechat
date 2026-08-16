"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UserRow } from "@/components/admin/UserRow";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
  fetchAdminUsers,
  type AdminAction,
} from "@/lib/admin";

/** The users table: search, the create dialog, and one row per account. */
export function AdminUsers({ currentUserId }: { currentUserId: string }) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: adminUsersKey,
    queryFn: fetchAdminUsers,
  });

  // Filtering client-side keeps typing instant. With a single page of users
  // there is nothing to gain from round-tripping `searchValue` to the server.
  const users = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter(
      (user) =>
        user.email.toLowerCase().includes(needle) ||
        user.name?.toLowerCase().includes(needle)
    );
  }, [data, search]);

  /**
   * Wrap an admin call so every action reports the same way and the table
   * refetches once it succeeds.
   */
  const { mutate: run, isPending: isMutating } = useMutation({
    mutationFn: async ({ action }: AdminAction) => action(),
    onSuccess: (_result, { success }) => {
      toast.success(success);
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
      // Role assignments move a role's holder count, so the roles screen is
      // stale too even when this action never touched a role directly.
      queryClient.invalidateQueries({ queryKey: adminRolesKey });
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
        Could not load users: {error.message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search users"
          />
        </InputGroup>

        <CreateUserDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-48">Roles</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
                busy={isMutating}
                run={run}
              />
            ))}

            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground h-24 text-center"
                >
                  No users match “{search}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
