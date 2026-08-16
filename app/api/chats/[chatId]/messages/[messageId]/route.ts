import { errorResponse, withUser, type RouteContext } from "@/lib/api-server";
import { deleteMessage } from "@/lib/chats";

type Context = RouteContext<{ chatId: string; messageId: string }>;

/** Remove one message from a chat. 404 unless both ids and the owner line up. */
export const DELETE = withUser<Context>(async (userId, _req, { params }) => {
  const { chatId, messageId } = await params;

  const deleted = await deleteMessage(userId, chatId, messageId);
  if (!deleted) return errorResponse("Message not found", 404);

  return new Response(null, { status: 204 });
});
