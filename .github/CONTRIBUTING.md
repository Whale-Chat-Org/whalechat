# Contributing to WhaleChat

Thank you for considering contributing to WhaleChat! We welcome contributions from everyone. By participating in this project, you agree to abide by our code of conduct.

## How to Contribute

### Reporting Issues

If you encounter any bugs, glitches, or have suggestions for improvements, please open an issue in the [GitHub repository](https://github.com/Whale-Chat-Org/whalechat/issues).

### Submitting Pull Requests

This repository is **trunk-based**: `main` is always releasable, and work happens
on short-lived branches that merge back within about a day. The full rules —
branch prefixes, rebasing, commit format, and the no-AI-attribution rule — are in
[docs/git.md](../docs/git.md). The short version:

1. Branch from an up-to-date `main`. Prefixes: `feat/`, `fix/`, `chore/`, `ci/`,
   `docs/`, `refactor/`.
   ```bash
   git switch main && git pull && git switch -c feat/short-description
   ```
2. Commit using [Conventional Commits](https://www.conventionalcommits.org) —
   `type(scope): imperative subject`. The body explains *why*, not what.
   ```bash
   git commit -m "feat(auth): allow admins to revoke a pending invite"
   ```
3. Keep the branch current by **rebasing** onto `main`. Never merge `main` into
   your branch — it makes the squash-merged diff dishonest.
   ```bash
   git fetch origin && git rebase origin/main
   ```
4. Push and open a pull request against `main`.
   ```bash
   git push -u origin feat/short-description
   ```
5. Once CI is green and the PR is approved, **squash merge** and delete the
   branch. If the change cannot land within about a day, land it incomplete but
   inert — behind a flag or unreferenced — rather than letting the branch age.

External contributors without push access should fork first and open the pull
request from their fork; everything else above is unchanged.

### Code Style

Please ensure your code adheres to the existing style and conventions:

```bash
npm run lint && npm run typecheck && npm test
```

Branching, commit format and the attribution rule are in [docs/git.md](../docs/git.md).

---

Thank you for your contributions!