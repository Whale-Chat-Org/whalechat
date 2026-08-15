#!/usr/bin/env bash
#
# One command to get from a cold machine to a running dev server.
#
#   ./start_local.sh
#
# Stops every running container, brings this project's Postgres and Redis up,
# applies migrations, then hands over to `next dev`. There is no seed step — the
# first administrator is claimed at /onboarding. Safe to run repeatedly; it never
# deletes a volume or an image.
set -euo pipefail

cd "$(dirname "$0")"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "Stopping running containers"
# One at a time: `docker stop a b c` errors out on Docker 29 (404 from the
# daemon), and a bare `xargs` would still run once on empty input.
docker ps -q | while read -r id; do docker stop "$id" >/dev/null; done
echo "done"

step "Freeing port 3000"
# A stale `next dev` survives a closed terminal often enough to be worth it.
pids=$(lsof -ti tcp:3000 || true)
if [ -n "$pids" ]; then
  echo "$pids" | while read -r pid; do kill -9 "$pid" 2>/dev/null || true; done
  echo "killed: $pids"
else
  echo "already free"
fi

step "Starting Postgres and Redis"
# --wait blocks on the healthchecks, so migrations below never race initdb.
# --remove-orphans clears containers left behind by a service this file used to
# define, which would otherwise sit there holding its ports.
docker compose up -d --wait --remove-orphans

step "Applying migrations"
npm run db:migrate

step "Starting the dev server"
echo "  app  http://localhost:3000"
echo
# There is no admin to seed: the first one is claimed at /onboarding, and the
# app redirects there on its own until that is done.
echo "  first run? http://localhost:3000/onboarding issues the admin license key."
echo
# Mail goes out through Resend. Without RESEND_API_KEY set — or for any recipient
# the resend.dev testing domain refuses — the key is printed to this log instead.
if ! grep -qE '^RESEND_API_KEY=.+' .env.local 2>/dev/null; then
  echo "  note: RESEND_API_KEY is unset — the license key will print here, not send."
  echo
fi
exec npm run dev
