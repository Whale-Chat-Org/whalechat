"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { request, type AdminRole, type RunAction } from "@/lib/admin";
import {
  RESOURCE_LABELS,
  STATEMENTS,
  formatPermission,
  type Permission,
  type Resource,
} from "@/lib/rbac/statements";

interface RoleDialogProps {
  /** The role being edited, or nothing when creating one. */
  role?: AdminRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: RunAction;
}

const RESOURCES = Object.keys(STATEMENTS) as Resource[];

/**
 * Create a role, or edit one's name and grants.
 *
 * @remarks The permission matrix is rendered from `STATEMENTS` in code rather
 * than from the `auth_permission` table. The table is a mirror the seed keeps in
 * step, and a row the code no longer defines enforces nothing — offering it
 * would let someone compose a role out of grants that silently do nothing.
 *
 * Permissions the viewer does not hold are disabled. That is a courtesy, not the
 * rule: `createRole` and `updateRole` intersect the request against the caller's
 * own permissions server-side, because otherwise `role:create` would quietly
 * mean every permission.
 *
 * The key is only editable at creation. It is what `User.role` mirrors and what
 * `lib/auth.ts`, `lib/onboarding.ts` and the seed compare against, so changing
 * it would have to rewrite every mirror in the same instant.
 */
export function RoleDialog({
  role,
  open,
  onOpenChange,
  run,
}: RoleDialogProps) {
  const { can } = usePermissions();
  const [granted, setGranted] = useState<Permission[] | null>(null);

  const checked = granted ?? role?.permissions ?? [];
  const isEdit = Boolean(role);

  function toggle(permission: Permission, on: boolean) {
    setGranted(
      on
        ? [...checked, permission]
        : checked.filter((current) => current !== permission)
    );
  }

  function close() {
    setGranted(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="max-h-[90svh] overflow-hidden">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);

            const body = JSON.stringify({
              key: String(form.get("key") ?? ""),
              name: String(form.get("name") ?? ""),
              description: String(form.get("description") ?? ""),
              permissions: checked,
            });

            run({
              action: () =>
                isEdit
                  ? request(`/api/admin/roles/${role?.id}`, {
                      method: "PATCH",
                      body,
                    })
                  : request("/api/admin/roles", { method: "POST", body }),
              success: isEdit ? "Role updated" : "Role created",
            });
            close();
          }}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${role?.name}` : "New role"}</DialogTitle>
            <DialogDescription>
              A role is a named bundle of permissions. Users can hold more than
              one.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            {!isEdit && (
              <Field>
                <FieldLabel htmlFor="role-key">Key</FieldLabel>
                <Input
                  id="role-key"
                  name="key"
                  required
                  placeholder="support"
                  pattern="[a-z][a-z0-9-]{1,30}"
                  title="Lower-case letters, digits and hyphens, starting with a letter."
                  autoComplete="off"
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="role-name">Name</FieldLabel>
              <Input
                id="role-name"
                name="name"
                required
                defaultValue={role?.name}
                autoComplete="off"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="role-description">Description</FieldLabel>
              <Input
                id="role-description"
                name="description"
                defaultValue={role?.description ?? ""}
                autoComplete="off"
              />
            </Field>

            <Field>
              <FieldLabel>Permissions</FieldLabel>
              <ScrollArea className="h-64 rounded-md border p-3">
                {RESOURCES.map((resource) => (
                  <div key={resource} className="mb-4 last:mb-0">
                    <p className="mb-2 text-xs font-semibold tracking-wide uppercase">
                      {RESOURCE_LABELS[resource]}
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {STATEMENTS[resource].map((action) => {
                        const permission = formatPermission(resource, action);
                        const grantable = can(permission);

                        return (
                          <label
                            key={permission}
                            className="flex items-center gap-2 text-sm data-[disabled=true]:opacity-50"
                            data-disabled={!grantable}
                            title={
                              grantable
                                ? undefined
                                : "You cannot grant a permission you do not hold."
                            }
                          >
                            <Checkbox
                              checked={checked.includes(permission)}
                              disabled={!grantable}
                              onCheckedChange={(value) =>
                                toggle(permission, value === true)
                              }
                            />
                            {action}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save role" : "Create role"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
