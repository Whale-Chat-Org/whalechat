<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!--
  Everything above is managed by `next dev`. It re-splices the span between the
  two BEGIN/END markers whenever the block goes stale, and preserves everything
  outside them byte-for-byte — so this index is safe here.

  Three rules follow from that:
    1. Never reformat or reindent inside the markers. Whitespace counts as stale
       and triggers a rewrite, which shows up as noise in your diff.
    2. Never copy the marker into CLAUDE.md. If CLAUDE.md hosted the block and
       AGENTS.md did not, Next would start editing CLAUDE.md instead.
    3. The block opens with an H1, so everything below uses ## and lower.
-->

## Project rules

This file is the map. The detail is in `docs/` — read the one that matches what
you are about to do.

| Doc | Read it before |
|---|---|
| [docs/commands.md](docs/commands.md) | Running, building, testing, or touching the database |
| [docs/architecture.md](docs/architecture.md) | Changing storage, or anything under `lib/` |
| [docs/modules/auth/](docs/modules/auth/README.md) | Anything touching accounts, sessions or `/admin` |
| [docs/git.md](docs/git.md) | **Any** commit, branch, merge or pull request |
| [docs/ci-cd.md](docs/ci-cd.md) | Touching `.github/workflows/`, the Dockerfile, or deployment |

The auth module is split by flow, so read the one you are changing rather than
all of it:

| Flow | Doc |
|---|---|
| First admin claims the instance | [onboarding.md](docs/modules/auth/onboarding.md) |
| License key, resend, start over | [activation.md](docs/modules/auth/activation.md) |
| Registration and email verification | [sign-up.md](docs/modules/auth/sign-up.md) |
| The `banned` gate and approving users | [approval.md](docs/modules/auth/approval.md) |
| Signing in and out | [sign-in.md](docs/modules/auth/sign-in.md) |
| Forgot and reset | [password-reset.md](docs/modules/auth/password-reset.md) |
| `proxy.ts` vs the DAL vs the handler | [authorization.md](docs/modules/auth/authorization.md) |
| Roles, permissions, the `User.role` mirror | [permissions.md](docs/modules/auth/permissions.md) |
| `/admin` capabilities | [admin-portal.md](docs/modules/auth/admin-portal.md) |

Three rules are short enough to state here, and are the ones most often broken:

- **No AI co-authorship.** No `Co-Authored-By:` trailer naming an assistant, no
  "Generated with …" footer, anywhere — commits, PR bodies, merge messages. The
  author is the local git identity. See [docs/git.md](docs/git.md).
- **Trunk-based.** `main` is always releasable; work happens on short-lived
  branches merged by PR. No long-lived `develop` or `release` branches.
- **Nothing here uses a hosted Better Auth service.** It is a self-hosted
  library. `BETTER_AUTH_SECRET` is a locally generated signing key, not an
  account credential — do not "wire up" an API key or a dashboard.

`README.md` is the human-facing front door and covers the same ground more
loosely. Where the two disagree, `docs/` is canonical for how to work in the
repo, and the code is canonical for what it does.

## Keeping these honest

Run **`/sync-context`** after a change that moves anything the docs describe — a
renamed file, a new script, a changed default, a reworked flow. It re-checks
every claim against the code rather than against itself, fixes the drift, and
reports what it could not verify. Pass a path to narrow it:
`/sync-context docs/modules/auth`.

It leaves changes in the working tree; it does not commit. Definition lives in
[.claude/commands/sync-context.md](.claude/commands/sync-context.md).
