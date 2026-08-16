---
description: Re-validate every doc against the current code and fix what has drifted
argument-hint: "[path or topic to limit the sweep, e.g. docs/modules/auth]"
---

Re-validate this repository's documentation against the code as it exists right
now, and correct whatever has drifted.

Scope: `$ARGUMENTS` if given, otherwise every tracked `.md` outside
`node_modules` — `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/**`, `.github/**`.

## The rule that matters most: verify, never recall

Every factual claim in a doc must be checked against the repo in this run. Not
against what you remember, not against what the doc already says, not against
how the library usually behaves.

For each claim, do one of:

- **Read the file.** Quote it, and cite `file:line`.
- **Run it.** Command names, script names and flags get run or at least
  `--help`-ed. `package.json` scripts, `npx` invocations, `docker compose`
  services, env var names.
- **Check the installed version**, in `node_modules`, not from memory. Library
  behaviour, option names, defaults and error codes are version-specific — read
  the `.d.ts` or the shipped source.
- **Mark it.** If a claim cannot be verified, say so in the report. Do not
  quietly keep it and do not quietly delete it.

Anything you cannot verify is a finding, not a detail to smooth over.

## What counts as drift

- A file, directory, script, route, env var or table that no longer exists, or
  now has a different name
- A command that no longer runs, or whose output has changed
- A version, default, option name or error code that has moved
- A link — relative path or anchor — that does not resolve
- A diagram whose steps no longer match the code
- A claim about behaviour that the code contradicts
- A doc that is now silent about something the code does, where the doc's own
  scope says it should not be

Duplication across docs is drift too: when two files describe the same thing,
keep the one whose scope owns it and have the other link to it.

## Diagrams

Add one only when prose is genuinely harder to follow. Do not decorate.

- **Process or control flow** — branches, gates, decisions, stage order:
  `flowchart`
- **Data or messages moving between components** — browser, proxy, server
  action, database, third party: `sequenceDiagram`

Every diagram must parse. Validate before finishing, e.g.

```bash
node -e "…mermaid.parse(src)…"    # jsdom is required; mermaid needs a DOM
```

An out-of-date diagram is worse than none, so fix or delete rather than leave.

## Keep it simple

Say the thing once, in the doc that owns it. Prefer a sentence to a paragraph
and a table to a list of near-identical bullets. Delete anything that is true but
useless — no restating what a filename already says.

Keep the existing voice: explain *why* something is the way it is, especially
where it looks wrong but is deliberate. Those notes are the point of these docs;
do not strip them while tidying.

## Order of work

1. Enumerate the docs in scope and what each one claims.
2. Verify the claims, cheapest checks first — file existence, then reads, then
   commands.
3. Fix what is wrong. Where a fix is not obvious, report rather than guess.
4. Re-check links and re-validate every mermaid block.
5. Run `npm run lint && npm run typecheck && npm test` if any code was touched.

## Report at the end

- **Corrected** — what was wrong, and what it says now
- **Unverifiable** — claims that could not be checked, and why
- **Left alone** — drift found but deliberately not fixed, with the reason

If nothing had drifted, say that plainly. A short honest report beats a long one.

Do not commit. Leave the changes in the working tree for review.
