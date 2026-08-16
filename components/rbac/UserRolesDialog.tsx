"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  adminRolesKey,
  fetchAdminRoles,
  request,
  type AdminUser,
  type RunAction,
} from "@/lib/admin";

interface UserRolesDialogProps {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: RunAction;
}

/**
 * Choose which roles a user holds.
 *
 * @remarks Checkboxes rather than a `<Select>`: roles live in a join table and a
 * user may hold several, which a single-value control cannot express.
 *
 * Submits the whole set with `PUT`, not a diff. Two administrators editing the
 * same user then produce one winner rather than an interleaved half-state, and
 * the server has a complete picture to run the escalation checks against.
 */
export function UserRolesDialog({
  user,
  open,
  onOpenChange,
  run,
}: UserRolesDialogProps) {
  const [selected, setSelected] = useState<string[] | null>(null);

  const { data: roles, isPending } = useQuery({
    queryKey: adminRolesKey,
    queryFn: fetchAdminRoles,
    enabled: open,
  });

  // Falls back to what the user holds until the first tick, so opening the
  // dialog shows their current roles rather than an empty list.
  const checked = selected ?? user.roles.map((role) => role.key);

  function toggle(key: string, on: boolean) {
    setSelected(
      on ? [...checked, key] : checked.filter((current) => current !== key)
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roles for {user.name || user.email}</DialogTitle>
          <DialogDescription>
            A user gets everything their roles grant, added together.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-3">
            {(roles ?? []).map((role) => (
              <label
                key={role.key}
                className="flex cursor-pointer items-start gap-3"
              >
                <Checkbox
                  checked={checked.includes(role.key)}
                  onCheckedChange={(value) => toggle(role.key, value === true)}
                />
                <span>
                  <span className="block text-sm font-medium">{role.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {role.description ??
                      `${role.permissions.length} permission(s)`}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              run({
                action: () =>
                  request(`/api/admin/users/${user.id}/roles`, {
                    method: "PUT",
                    body: JSON.stringify({ roleKeys: checked }),
                  }),
                success: `Updated roles for ${user.email}`,
              });
              onOpenChange(false);
            }}
          >
            Save roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
