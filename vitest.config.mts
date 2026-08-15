import path from "node:path";
import { defineConfig } from "vitest/config";

// `.mts` so Vite loads this as ESM. As a `.ts` file it is loaded as CommonJS,
// which works but warns that the behaviour is going away in a future major.
export default defineConfig({
  test: {
    // Everything under test is server-side logic — key generation, the
    // onboarding state machine, email bodies. No DOM is involved, and asking for
    // one would only add a dependency and startup cost.
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json. Doing it by hand rather
    // than pulling in vite-tsconfig-paths for a single mapping.
    alias: { "@": path.resolve(import.meta.dirname) },
  },
});
