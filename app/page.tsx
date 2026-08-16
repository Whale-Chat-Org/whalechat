import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { ChatApp } from "@/components/ChatApp";
import { chatsKey } from "@/lib/chat-api";
import { listChats } from "@/lib/chats";
import { requireOnboarded } from "@/lib/onboarding";
import { can } from "@/lib/rbac/dal";
import { getServerSession } from "@/lib/session";

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

  // Prime the sidebar so it renders populated rather than flashing a spinner.
  // Calls the data layer directly — a server component has the session already,
  // so there is no reason to make an HTTP request back into our own route.
  await queryClient.prefetchQuery({
    queryKey: chatsKey,
    queryFn: () => listChats(session.user.id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChatApp canAdminister={await can("user:list")} />
    </HydrationBoundary>
  );
}
