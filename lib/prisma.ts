import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * The Prisma client, as a module-level singleton.
 *
 * @remarks Next's dev server re-evaluates modules on every edit. Without the
 * global cache each reload would open a fresh connection pool and Postgres would
 * eventually refuse new ones. Prisma 7 has no built-in query engine, so the
 * `pg` driver adapter is not optional.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    transactionOptions: {
      // Better Auth runs a whole endpoint inside one transaction, and sign-up's
      // endpoint includes both a deliberately slow password hash and the
      // verification email. Prisma's 5s default trips on a cold start; 20s
      // leaves room without hiding a genuinely stuck transaction forever.
      timeout: 20_000,
      maxWait: 10_000,
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
