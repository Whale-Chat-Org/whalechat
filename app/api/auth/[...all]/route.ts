import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/** Better Auth's own endpoints — sign-in, sign-up, verification, the lot. */
export const { GET, POST } = toNextJsHandler(auth);
