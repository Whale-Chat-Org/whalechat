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
| [docs/architecture.md](docs/architecture.md) | Changing auth, onboarding, storage, or anything under `lib/` |
| [docs/git.md](docs/git.md) | **Any** commit, branch, merge or pull request |
| [docs/ci-cd.md](docs/ci-cd.md) | Touching `.github/workflows/`, the Dockerfile, or deployment |

Two rules are short enough to state here, and are the ones most often broken:

- **No AI co-authorship.** No `Co-Authored-By:` trailer naming an assistant, no
  "Generated with …" footer, anywhere — commits, PR bodies, merge messages. The
  author is the local git identity. See [docs/git.md](docs/git.md).
- **Trunk-based.** `main` is always releasable; work happens on short-lived
  branches merged by PR. No long-lived `develop` or `release` branches.

`README.md` is the human-facing front door and covers the same ground more
loosely. Where the two disagree, `docs/` is canonical for how to work in the
repo, and the code is canonical for what it does.
