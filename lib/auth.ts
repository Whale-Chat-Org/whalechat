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
