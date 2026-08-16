import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Gate the app behind sign-in.
 *
 * @remarks This is an **optimistic** check only — it tests for the presence of
 * the session cookie without validating it, which is what Next recommends for
 * proxy (`app/page.tsx` and `app/admin/page.tsx` hold the authoritative checks).
 * A forged cookie gets past this redirect but not past the page itself.
 *
 * The asymmetry below is deliberate. *Missing* cookie is safe to act on: you
 * cannot be signed in without one, so redirecting to sign-in is always right.
 * *Present* cookie proves nothing — the session it names may be long gone, and
 * Redis holds sessions with persistence deliberately turned off, so every Redis
 * restart produces exactly that state. Bouncing those users off `/auth/sign-in`
 * would trap them: the page redirects to sign-in, the proxy redirects back, and
 * the only escape is clearing cookies by hand. So the "already signed in, go
 * home" decision is made in `app/auth/[path]/page.tsx`, where the session can be
 * verified for real.
 */
export function proxy(request: NextRequest) {
  const isAuthed = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;
  // `/onboarding` has to be reachable with no session — it is where the very
  // first administrator comes from, so there is nobody who *could* be signed in
  // yet. Sending it to sign-in would loop: the sign-in page redirects back here
  // until setup is finished.
  const isAuthRoute =
    pathname.startsWith("/auth") || pathname.startsWith("/onboarding");

  if (!isAuthed && pathname.startsWith("/api/")) {
    // Redirecting an API call would hand the caller an HTML page, which blows up
    // on response.json(). Answer in the same shape the route would.
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isAuthed && !isAuthRoute) {
    const signIn = new URL("/auth/sign-in", request.url);
    // `redirectTo` is the parameter Better Auth UI reads back off the URL, so
    // signing in returns the user to wherever they were heading.
    if (pathname !== "/") signIn.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

/** Everything except Next internals, the auth endpoints and static files. */
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
