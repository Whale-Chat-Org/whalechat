"use client";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser-side Better Auth client. */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [adminClient()],
});

/** The methods used often enough to be worth naming directly. */
export const { signIn, signOut, signUp, useSession } = authClient;
