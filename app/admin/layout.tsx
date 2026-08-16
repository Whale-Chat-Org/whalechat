import Link from "next/link";
import type { ReactNode } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Button } from "@/components/ui/button";

/**
 * Shared chrome for the admin portal.
 *
 * @remarks **A layout is not an authorization boundary.** It does not re-run
 * when the user navigates between the pages beneath it, and Next gives no
 * ordering guarantee that would make a check here run before a page renders. So
 * it checks nothing, and every page under it repeats its own
 * `requireOnboarded()` → `requireViewer()` → `requirePermission()` gate.
 *
 * There is deliberately no `loading.tsx` beside this file either. It would send
 * a static shell before the gates resolve, committing the response as a 200 —
 * after which `forbidden()` can still render its UI but can no longer set a 403.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Who can get in, and what they can do once they are.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to chat</Link>
        </Button>
      </header>

      <AdminTabs />

      {children}
    </main>
  );
}
