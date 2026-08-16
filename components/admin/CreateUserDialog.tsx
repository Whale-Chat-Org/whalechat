"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BUILTIN_ROLES } from "@/lib/access";
import {
  adminRolesKey,
  adminUsersKey,
  fetchAdminRoles,
  request,
} from "@/lib/admin";

/**
 * Add a user without making them queue.
 *
 * @remarks Creation still writes through the database hook that bans every new
 * account, so `POST /api/admin/users` lifts the ban immediately afterwards — an
 * administrator typing the address in *is* the approval. The hook cannot tell
 * the two apart, which is why the ban is undone rather than skipped.
 *
 * Roles are checkboxes, not a `<Select>`: a user may hold several, and the
 * options come from the database rather than from a hard-coded pair.
 */
export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [roleKeys, setRoleKeys] = useState<string[]>([BUILTIN_ROLES.user]);
  const queryClient = useQueryClient();

  const { data: roles } = useQuery({
    queryKey: adminRolesKey,
    queryFn: fetchAdminRoles,
    enabled: open,
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: (form: FormData) =>
      request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          roleKeys,
        }),
      }),
    onSuccess: () => {
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
      queryClient.invalidateQueries({ queryKey: adminRolesKey });
      setOpen(false);
      setRoleKeys([BUILTIN_ROLES.user]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="ml-auto">
          <UserPlus />
          Add user
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create(new FormData(event.currentTarget));
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              They can sign in straight away — no approval, no email confirmation.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="new-user-name">Name</FieldLabel>
              <Input id="new-user-name" name="name" required autoComplete="off" />
            </Field>

            <Field>
              <FieldLabel htmlFor="new-user-email">Email</FieldLabel>
              <Input
                id="new-user-email"
                name="email"
                type="email"
                required
                autoComplete="off"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="new-user-password">Password</FieldLabel>
              <Input
                id="new-user-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>

            <Field>
              <FieldLabel>Roles</FieldLabel>
              <div className="space-y-2">
                {(roles ?? []).map((entry) => (
                  <label
                    key={entry.key}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={roleKeys.includes(entry.key)}
                      onCheckedChange={(value) =>
                        setRoleKeys((current) =>
                          value === true
                            ? [...current, entry.key]
                            : current.filter((key) => key !== entry.key)
                        )
                      }
                    />
                    {entry.name}
                  </label>
                ))}
              </div>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
