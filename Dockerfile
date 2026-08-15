# Production image. Local development runs `npm run dev` on the host instead —
# Next's own docs recommend that over containerised dev on macOS.
#
# Build:  docker compose --profile prod up --build
# Or:     docker build --build-arg NEXT_PUBLIC_APP_URL=https://example.com -t whalechat .
#
# The build needs egress to binaries.prisma.sh: `prisma generate` fetches the
# schema engine. Behind a TLS-inspecting proxy it fails with "self-signed
# certificate in certificate chain" — pass the proxy's root CA in and point
# NODE_EXTRA_CA_CERTS at it. The finished image never contacts it again; Prisma 7
# talks to Postgres through the pg driver adapter, with no engine binary at all.

# --- deps -------------------------------------------------------------------
# Split from the build so editing source does not re-run npm ci.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips the repo's `postinstall` (prisma generate). Generating
# here would only be thrown away: the builder stage runs it again against the
# real source. It also keeps this layer from reaching binaries.prisma.sh, which
# fails outright behind a TLS-inspecting proxy.
RUN npm ci --ignore-scripts

# --- builder ----------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it has to be
# known here rather than at run time.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- runner -----------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` traces exactly the node_modules the server touches; the
# static and public directories are not part of that trace and must be copied.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations are applied by the operator (`npm run db:migrate`), not on boot: a
# container that migrates at startup races itself the moment you run two.
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
