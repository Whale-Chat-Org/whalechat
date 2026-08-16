# Sign in and sign out

`/auth/sign-in` and `/auth/sign-out`, both served by `app/auth/[path]/page.tsx`.

## What can refuse you

In the order Better Auth checks them:

| Response | Code | Meaning |
|---|---|---|
| 401 | — | Wrong password |
| 403 | `EMAIL_NOT_VERIFIED` | Verification link not clicked yet |
| 403 | `BANNED_USER` | Not approved, or access revoked — see [approval.md](approval.md) |
| 200 | — | Session issued, cookie set |

Email verification is checked before the ban, so a brand-new account sees
"Email not verified" first and the approval message only after confirming.

Better Auth UI surfaces all of these through its `ErrorToaster`, which reads
`error.message` — so `bannedUserMessage` in `lib/auth.ts` is the exact string a
pending user reads. No custom error handling.

## Where the session lives

Sessions are written to Redis via `secondaryStorage`, not round-tripped to
Postgres on every request. Redis runs **without persistence** here — it is a
cache and a coordination surface, never a source of truth. A flush signs
everyone out, which is annoying and never incorrect.

That property is exactly what shapes the authorization split; see
[authorization.md](authorization.md).

## Signed-out-only views

`app/auth/[path]/page.tsx` sends an already-signed-in user home from `sign-in`,
`sign-up`, `forgot-password`, `reset-password` and `reset-link-sent`.

It does that by **validating** the session, not by trusting the cookie. Doing it
in `proxy.ts` instead produced an unbreakable redirect loop: a cookie whose
session Redis no longer holds bounced `/` → sign-in → `/` forever. The remaining
views — `sign-out`, `redirect`, `verify-email` — stay reachable in both states.

## Sign out

`/auth/sign-out` runs Better Auth UI's `SignOut` view, which calls
`authClient.signOut()` and navigates to `redirectTo`. The session is deleted from
Redis and the cookie cleared. `proxy.ts` deliberately does not bounce a
"signed-in" user away from this route, for the reason above.
