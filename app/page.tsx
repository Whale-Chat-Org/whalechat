import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { ChatApp } from "@/components/ChatApp";
import { requireOnboarded } from "@/lib/onboarding";
import { getServerSession, isAdmin } from "@/lib/session";

/**
 * The chat route, gated behind sign-in.
 *
 * @remarks `proxy.ts` already redirects unauthenticated requests, but that is an
 * optimistic cookie check. This validates the session for real before rendering,
 * so a forged cookie cannot reach the chat.
 */
export default async function Home() {
  await requireOnboarded();

  const { queryClient, session } = await getServerSession();

  if (!session) redirect("/auth/sign-in");

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChatApp isAdmin={isAdmin(session)} />
    </HydrationBoundary>
  );
}
