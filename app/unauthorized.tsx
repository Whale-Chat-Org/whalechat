import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * What an unauthenticated visitor sees when a page needs a session.
 *
 * @remarks Rendered by Next wherever `unauthorized()` is called, with a real 401
 * status. Most pages never reach it: they pass `redirectTo` to `requireViewer`
 * and get a redirect to sign-in that returns the visitor to where they were
 * aiming, which is the better outcome for the usual cause — a cookie that
 * outlived its session, since Redis holds sessions with persistence off.
 *
 * This is the fallback for callers with no sensible destination to return to.
 */
export default function Unauthorized() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Not signed in</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sign in to continue.
        </p>
      </div>

      <Button asChild variant="outline" size="sm">
        <Link href="/auth/sign-in">Go to sign in</Link>
      </Button>
    </main>
  );
}
