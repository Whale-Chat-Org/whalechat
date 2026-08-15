# Git

## Attribution

**Never add AI co-authorship to anything.** No `Co-Authored-By:` trailer naming
an assistant, no "Generated with …" footer — not in commits, not in pull request
bodies, not in merge messages.

The author and committer are the local git identity (`git config user.name` /
`user.email`) and nothing else. Authorship records who is *accountable* for a
change, and that is a person; a tool used along the way is no more an author than
the editor the code was typed in.

This applies retroactively: the six commits that predate this rule had their
trailers stripped.

## Trunk-based development

```
main  ── always releasable, protected
  │
  └── feat/short-description          short-lived, < ~1 day
        │
        └── PR ──▶ test · scan · build
              │
              └── squash merge ──▶ main ──▶ deploy (approval gate)
```

- **`main` is always releasable.** Anything merged is something you would be
  willing to deploy.
- **Branch from `main`, merge back within about a day.** If a change cannot land
  that fast, land it incomplete but inert — behind a flag, or unreferenced —
  rather than letting the branch age. Long branches are how merge pain is made.
- **Rebase onto `main`; never merge `main` into a branch.** Keeps history linear
  and makes the squash-merged commit an honest diff against the trunk.
- **No long-lived `develop` or `release` branches.** There is one trunk.
- **Delete the branch after merge.**

Branch prefixes: `feat/`, `fix/`, `chore/`, `ci/`, `docs/`, `refactor/`.

This is what the pipeline already assumes — pull requests run test, scan and the
image build; merging to `main` adds the ACR push and the approval-gated deploy.
See [ci-cd.md](ci-cd.md).

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org):

```
type(scope): imperative subject under ~72 characters

Body explaining why, not what — the diff already says what. Call out
decisions a reader would otherwise have to reverse-engineer, and anything
that looks wrong but is deliberate.
```

Types in use: `feat`, `fix`, `ci`, `docs`, `chore`, `refactor`, `test`, `build`.

The existing history is the reference — `git log` shows the intended shape. Where
a commit encodes a non-obvious decision (why a hook forces a value, why a scanner
threshold is set where it is), the body says so.

## History

**Never rewrite published history.** Once a commit is pushed anywhere anyone else
might have fetched it, it is immutable.

The one rewrite this repo has had — stripping AI trailers with
`git filter-repo` — was only safe because the repo had never been pushed. That
window is closed the moment there is a remote.

## Do not commit

`.env*` (except `.env.example`), `generated/`, `.next/`, anything under
`node_modules/`. All are already in `.gitignore`; the point is not to work around
it. Secrets belong in GitHub Actions secrets or App Service configuration.
