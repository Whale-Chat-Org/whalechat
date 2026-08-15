import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored code. These directories are owned by generators — `npx shadcn add`
    // for the first three, `prisma generate` for the last — and are overwritten
    // wholesale on the next run, so linting them only reports upstream's style
    // choices as our errors. Anything we actually maintain lives elsewhere.
    "components/ui/**",
    "components/auth/**",
    "lib/auth/**",
    "hooks/use-mobile.tsx",
    "generated/**",
  ]),
]);

export default eslintConfig;
