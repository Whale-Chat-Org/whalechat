"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Role } from "@/lib/access";
import { adminUsersKey } from "@/lib/admin";
import { authClient } from "@/lib/auth-client";

/**
 * Add a user without making them queue.
 *
 * @remarks `admin.createUser` writes through the same database hook that bans
 * every new account, so the account has to be approved immediately afterwards —
 * an administrator typing the address in *is* the approval. The email counts as
 * confirmed for the same reason.
 */
export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("user");
  const queryClient = useQueryClient();

  const { mutate: create, isPending } = useMutation({
    mutationFn: async (form: FormData) => {
      const { data, error } = await authClient.admin.createUser({
        email: String(form.get("email")),
        password: String(form.get("password")),
        name: String(form.get("name")),
        role,
        data: { emailVerified: true },
      });
      if (error) throw new Error(error.message ?? "Could not create the user");

      const userId = data?.user?.id;
      if (!userId) return;

      const { error: unbanError } = await authClient.admin.unbanUser({ userId });
      if (unbanError) {
        throw new Error(
          `Created, but could not approve automatically: ${unbanError.message}`
        );
      }
    },
    onSuccess: () => {
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
      setOpen(false);
      setRole("user");
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
              <FieldLabel htmlFor="new-user-role">Role</FieldLabel>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as Role)}
              >
                <SelectTrigger id="new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
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
