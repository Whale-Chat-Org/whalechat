import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit .next/standalone so the Dockerfile can ship a runtime without node_modules.
  output: "standalone",
  // Native/CJS server-only packages that must not be bundled. `pg` is on Next's
  // built-in list already; these two are not.
  serverExternalPackages: ["ioredis", "@prisma/adapter-pg"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Turns on `forbidden()` and `unauthorized()` and the `forbidden.tsx` /
    // `unauthorized.tsx` conventions. Still experimental in 16.3.1 and
    // default-off, so it has to be asked for by name.
    //
    // Without it those calls throw an interrupt nothing renders, so the RBAC
    // guards in `lib/rbac/dal.ts` depend on this flag staying on.
    authInterrupts: true,
  },
  turbopack: {
    // Pin the workspace root. Without this, a stray package-lock.json in a
    // parent directory makes Next infer the wrong root and warn on every run.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
