import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * What a signed-in user sees when they lack the permission a page needs.
 *
 * @remarks Rendered by Next wherever `forbidden()` is called, with a real 403
 * status attached. It replaces the "Not authorised" block `/admin` used to
 * render inline, which returned 200 and had to be repeated by every gated page.
 *
 * Deliberately says nothing about what the permission was. Someone who cannot
 * open a page has no use for its access requirements, and spelling them out
 * tells an unauthorized visitor what to go looking for.
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Not authorised</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your account does not have access to this page. Ask an administrator
          if you think it should.
        </p>
      </div>

      <Button asChild variant="outline" size="sm">
        <Link href="/">Back to chat</Link>
      </Button>
    </main>
  );
}
