# WhaleChat

A minimal, local-first chat client for the DeepSeek API, with a self-hosted auth
module in front of it.

Chats and messages live in your browser's IndexedDB and never reach the server.
Postgres holds accounts only. The DeepSeek key lives in `.env.local` and is read
**server-side only** — it never reaches the browser.

There are no admin credentials in the environment: the first administrator
claims the instance at `/onboarding` and everyone after them waits for approval.

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill it in — see the comments in the file
./start_local.sh
```

`start_local.sh` stops any running containers, brings up Postgres and Redis,
applies migrations, and starts the dev server on <http://localhost:3000>. Get a
DeepSeek key at <https://platform.deepseek.com>.

### Claim the instance

On a fresh database nobody administers the app, so every route redirects to
**`/onboarding`**:

1. **Claim** — enter your email. A **license key** is sent to that address.
2. **Activate** — enter the key. Setup is done, and that key is now your
   password; change it later under account settings.

Mail goes through [Resend](https://resend.com), and `RESEND_API_KEY` is optional
locally — leave it unset and the license key, verification and password-reset
links are printed to the server console instead. That is enough to walk through
every flow without an account.

> ⚠️ Whoever reaches `/onboarding` first on an unclaimed database becomes the
> administrator. Claim it before you expose it.

After that, sign-up is open but access is not: new accounts confirm their email,
then wait for an administrator to approve them from `/admin`.

## Using it

- **New chat** opens a session immediately, with no form. It titles itself from
  your first message.
- Each chat row has a **⋯ menu** to rename or delete it; renaming also lets you
  switch model and set a per-chat system prompt.
- Requests go from the browser to `/api/chat`, which adds the key and forwards to
  DeepSeek. The browser never talks to `api.deepseek.com` directly.
- Messages render GitHub-flavored markdown, syntax-highlighted code, KaTeX math
  (`$$x^2$$`) and Mermaid diagrams (```mermaid fences).

Settings are constants in `lib/deepseek.ts` — there is no settings UI:

| Setting | Value |
|---|---|
| Models | `deepseek-v4-flash` (default), `deepseek-v4-pro` |
| Temperature | `1.3` — DeepSeek's recommendation for conversation |
| `max_tokens` | omitted, so the model runs to its own limit |
| History | full conversation sent every request, never trimmed |

Both models have a 1M-token context window, which is why there is no
summarization or context-window management to configure.

> Because the key is read by a server route, this app needs a Node server —
> `npm run build && npm start`, or the [Dockerfile](Dockerfile). It cannot be
> exported as a static site.

## Documentation

| Doc | Covers |
|---|---|
| [docs/commands.md](docs/commands.md) | Every script, running one test, migrations, the local stack |
| [docs/architecture.md](docs/architecture.md) | The auth layering, the `banned` states, onboarding, and the traps |
| [docs/ci-cd.md](docs/ci-cd.md) | The pipeline, its stages, and the Azure setup |
| [docs/git.md](docs/git.md) | Branching, commit format, attribution |

[AGENTS.md](AGENTS.md) indexes the same set for coding agents.

## Contributing

`main` is trunk-based: always releasable, worked on through short-lived branches
merged by pull request. See [docs/git.md](docs/git.md).

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Zustand and
localforage on the front; Better Auth, Prisma 7, Postgres and Redis behind it.

## License

MIT — see [LICENSE](LICENSE). Originally forked from
[0xarchit/ByokChat](https://github.com/0xarchit/ByokChat).
