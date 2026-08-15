import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/onboarding";
import { getServerSession, isAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · WhaleChat" };

/**
 * The admin portal.
 *
 * @remarks This is the real authorization boundary. `proxy.ts` cannot help —
 * Next's proxy runs without access to the database, so it can only tell whether
 * *a* session cookie exists, never whose or what role it carries. The sidebar
 * link is decoration; this check is the gate.
 */
export default async function AdminPage() {
  await requireOnboarded();

  const { queryClient, session } = await getServerSession();

  if (!session) redirect("/auth/sign-in?redirectTo=/admin");

  if (!isAdmin(session)) {
    // Rendered rather than redirected: a silent bounce to the chat reads as a
    // broken link, and `forbidden()` is still behind an experimental flag.
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Not authorised</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The admin portal is limited to administrators.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to chat</Link>
        </Button>
      </main>
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto w-full max-w-5xl p-6">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              New sign-ups wait here until you approve them.
            </p>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to chat</Link>
          </Button>
        </header>

        <AdminUsers currentUserId={session.user.id} />
      </main>
    </HydrationBoundary>
  );
}
