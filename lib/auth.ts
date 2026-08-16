import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { redisStorage } from "@better-auth/redis-storage";
import {
  PENDING_APPROVAL_MESSAGE,
  PENDING_APPROVAL_REASON,
} from "./access";
import { actionEmail, sendMail } from "./email";
import { prisma } from "./prisma";
import { adoptRolesFromMirror } from "./rbac/roles";
import { redis } from "./redis";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  // Schema lives in prisma/schema.prisma; `transaction: true` because Postgres
  // supports them and multi-table writes (user + account on sign-up) should not
  // be able to half-succeed.
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  // Sessions, verification records and rate-limit counters live in Redis rather
  // than round-tripping to Postgres on every request. Losing it signs everyone
  // out; it never loses a user.
  secondaryStorage: redisStorage({ client: redis }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: APP_URL,

  // Already the default, and set anyway. This instance is entirely self-hosted —
  // Postgres, Redis and the Better Auth library, with nothing hosted behind it —
  // and telemetry is the one part of the library that would talk to a service.
  // Stating it means an upstream default flip cannot quietly turn it on.
  //
  // It does NOT close the environment route. The check is
  // `getBooleanEnvVar("BETTER_AUTH_TELEMETRY", false) || options.telemetry.enabled`
  // (@better-auth/telemetry/dist/index.mjs), so the env var ORs in and wins over
  // this. Keep that variable unset wherever this runs.
  telemetry: { enabled: false },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const { text, html } = actionEmail({
        heading: "Reset your password",
        body: "Someone asked to reset the password for this account. If that wasn't you, ignore this email — nothing has changed.",
        buttonLabel: "Choose a new password",
        url,
      });
      await sendMail({ to: user.email, subject: "Reset your password", text, html });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { text, html } = actionEmail({
        heading: "Confirm your email",
        body: "Confirm this address to finish creating your account. An administrator still has to approve it before you can sign in.",
        buttonLabel: "Confirm email",
        url,
      });
      await sendMail({ to: user.email, subject: "Confirm your email", text, html });
    },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * Hold every new account until an admin lets it in.
         *
         * @remarks Runs *after* the admin plugin's own create hook (Better Auth
         * collects hooks into a list, plugins first), so spreading `user` keeps
         * the `role` that hook just stamped. The ban itself is enforced on
         * session creation, which is why sign-up still succeeds and only the
         * first sign-in is refused.
         *
         * `banned` is forced, never defaulted. The admin plugin declares that
         * field with `defaultValue: false`, so sign-up arrives here with an
         * explicit `banned: false` already stamped on it — a `??` would read
         * that as an intentional choice and let every registration straight in.
         *
         * `banReason` has no such default, so an explicit one does survive.
         * That is how onboarding marks its half-claimed administrator as
         * "not finished setting up" rather than "waiting in the approval queue",
         * without needing a column of its own.
         */
        before: async (user) => ({
          data: {
            ...user,
            banned: true,
            banReason: user.banReason ?? PENDING_APPROVAL_REASON,
          },
        }),

        /**
         * Turn the role the plugin just stamped into `UserRole` rows.
         *
         * @remarks Creation is the one moment `User.role` leads and the join
         * table follows — everywhere else the direction is the other way round.
         * The plugin writes `defaultRole` for a sign-up and the explicit value
         * for `auth.api.createUser({ role: "admin" })` in
         * `app/onboarding/actions.ts`, and without this the first administrator
         * would have a mirror with nothing behind it. The next mirror rebuild
         * would then read zero rows and quietly demote them, on an instance with
         * no second administrator to undo it.
         *
         * Safe to reach Postgres directly: Better Auth queues `after` hooks
         * through `queueAfterTransactionHook`, so the user row is committed by
         * the time this runs.
         */
        after: async (user) => {
          // `role` is typed `unknown` here — the hook sees the raw record, and
          // the column belongs to a plugin rather than to the core user shape.
          await adoptRolesFromMirror(
            user.id,
            typeof user.role === "string" ? user.role : null
          );
        },
      },
    },
  },

  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      // Replaces the default "you have been banned" wording, which is wrong for
      // the overwhelmingly common case of simply not being approved yet.
      bannedUserMessage: PENDING_APPROVAL_MESSAGE,
    }),
  ],
});
