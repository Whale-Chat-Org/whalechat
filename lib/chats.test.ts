import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These tests exist for one property: a chat id is not a capability. Knowing
 * someone else's id must not read, change or delete their data.
 *
 * The fake below therefore *honours* the `where` clause it is handed rather than
 * returning a canned row. Drop `userId` from a query in `chats.ts` and the
 * filter stops excluding anything, so the cross-user cases below fail — which is
 * the whole point. Asserting on the arguments instead would only restate the
 * implementation back to itself.
 */

interface ChatRow {
  id: string;
  userId: string;
  name: string;
  model: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  tokenCount: number | null;
  createdAt: Date;
}

const db: { chats: ChatRow[]; messages: MessageRow[] } = {
  chats: [],
  messages: [],
};

let nextId = 0;

type Where = Record<string, unknown>;

function chatMatches(chat: ChatRow, where: Where = {}) {
  if (where.id !== undefined && chat.id !== where.id) return false;
  if (where.userId !== undefined && chat.userId !== where.userId) return false;
  return true;
}

function messageMatches(message: MessageRow, where: Where = {}) {
  if (where.id !== undefined && message.id !== where.id) return false;
  if (where.chatId !== undefined && message.chatId !== where.chatId) {
    return false;
  }

  const nested = where.chat as { userId?: string } | undefined;
  if (nested?.userId !== undefined) {
    const chat = db.chats.find((c) => c.id === message.chatId);
    if (chat?.userId !== nested.userId) return false;
  }

  return true;
}

const withCountOf = (chat: ChatRow) => ({
  ...chat,
  _count: { messages: db.messages.filter((m) => m.chatId === chat.id).length },
});

const messagesOf = (chatId: string) =>
  db.messages
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

vi.mock("./prisma", () => ({
  prisma: {
    chat: {
      findMany: ({ where }: { where?: Where }) =>
        db.chats
          .filter((c) => chatMatches(c, where))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map(withCountOf),

      // Only ever called with `select: { messages: … }`, so that is all it serves.
      findFirst: ({ where }: { where?: Where }) => {
        const chat = db.chats.find((c) => chatMatches(c, where));
        return chat ? { messages: messagesOf(chat.id) } : null;
      },

      create: ({ data }: { data: Omit<ChatRow, "createdAt" | "updatedAt"> }) => {
        const chat: ChatRow = {
          ...data,
          id: data.id ?? `generated-${++nextId}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.chats.push(chat);
        return withCountOf(chat);
      },

      updateMany: ({ where, data }: { where?: Where; data: Partial<ChatRow> }) => {
        const rows = db.chats.filter((c) => chatMatches(c, where));
        rows.forEach((chat) => Object.assign(chat, data));
        return { count: rows.length };
      },

      deleteMany: ({ where }: { where?: Where }) => {
        const doomed = db.chats.filter((c) => chatMatches(c, where));
        db.chats = db.chats.filter((c) => !doomed.includes(c));
        // Stands in for `onDelete: Cascade` on the relation.
        const ids = new Set(doomed.map((c) => c.id));
        db.messages = db.messages.filter((m) => !ids.has(m.chatId));
        return { count: doomed.length };
      },
    },

    message: {
      create: ({ data }: { data: Omit<MessageRow, "id" | "createdAt"> }) => {
        const message: MessageRow = {
          ...data,
          id: `generated-${++nextId}`,
          createdAt: new Date(),
        };
        db.messages.push(message);
        return message;
      },

      deleteMany: ({ where }: { where?: Where }) => {
        const doomed = db.messages.filter((m) => messageMatches(m, where));
        db.messages = db.messages.filter((m) => !doomed.includes(m));
        return { count: doomed.length };
      },
    },
  },
}));

const {
  addMessage,
  createChat,
  deleteChat,
  deleteMessage,
  listChats,
  listMessages,
  updateChat,
} = await import("./chats");

const ALICE = "alice";
const BOB = "bob";

const chat = (over: Partial<ChatRow> = {}): ChatRow => ({
  id: "c-alice",
  userId: ALICE,
  name: "Alice's chat",
  model: "deepseek-v4-flash",
  systemPrompt: "",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const message = (over: Partial<MessageRow> = {}): MessageRow => ({
  id: "m-1",
  chatId: "c-alice",
  role: "user",
  content: "hello",
  tokenCount: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

beforeEach(() => {
  nextId = 0;
  db.chats = [
    chat(),
    chat({ id: "c-bob", userId: BOB, name: "Bob's chat" }),
  ];
  db.messages = [
    message({ id: "m-2", createdAt: new Date("2026-01-01T00:00:02Z") }),
    message({ id: "m-1", createdAt: new Date("2026-01-01T00:00:01Z") }),
    message({ id: "m-bob", chatId: "c-bob" }),
  ];
});

describe("cross-user access", () => {
  it("does not list another user's chats", async () => {
    const chats = await listChats(ALICE);

    expect(chats.map((c) => c.id)).toEqual(["c-alice"]);
  });

  it("returns null for another user's messages, so the route 404s", async () => {
    expect(await listMessages(BOB, "c-alice")).toBeNull();
  });

  it("does not update another user's chat", async () => {
    expect(await updateChat(BOB, "c-alice", { name: "owned" })).toBe(false);
    expect(db.chats.find((c) => c.id === "c-alice")?.name).toBe("Alice's chat");
  });

  it("does not delete another user's chat", async () => {
    expect(await deleteChat(BOB, "c-alice")).toBe(false);
    expect(db.chats.some((c) => c.id === "c-alice")).toBe(true);
  });

  it("does not append to another user's chat", async () => {
    const before = db.messages.length;

    expect(
      await addMessage(BOB, "c-alice", { role: "user", content: "hi" })
    ).toBeNull();
    expect(db.messages).toHaveLength(before);
  });

  it("does not delete another user's message", async () => {
    expect(await deleteMessage(BOB, "c-alice", "m-1")).toBe(false);
    expect(db.messages.some((m) => m.id === "m-1")).toBe(true);
  });

  it("does not delete a message by naming a chat the caller does own", async () => {
    // The message id is Alice's; the chat id is Bob's own. Scoping on ownership
    // alone would let this through.
    expect(await deleteMessage(BOB, "c-bob", "m-1")).toBe(false);
    expect(db.messages.some((m) => m.id === "m-1")).toBe(true);
  });
});

describe("the owner's own access", () => {
  it("lists chats newest first, with a counted messageCount", async () => {
    await addMessage(ALICE, "c-alice", { role: "user", content: "third" });
    const [first] = await listChats(ALICE);

    expect(first.id).toBe("c-alice");
    expect(first.messageCount).toBe(3);
  });

  it("reads its own messages in send order", async () => {
    const messages = await listMessages(ALICE, "c-alice");

    expect(messages?.map((m) => m.id)).toEqual(["m-1", "m-2"]);
  });

  it("attributes a new chat to the session user", async () => {
    const created = await createChat(ALICE, {
      name: "New Chat",
      model: "deepseek-v4-flash",
      systemPrompt: "",
    });

    expect(db.chats.find((c) => c.id === created.id)?.userId).toBe(ALICE);
    expect(created.messageCount).toBe(0);
  });

  it("updates and deletes its own chat", async () => {
    expect(await updateChat(ALICE, "c-alice", { name: "renamed" })).toBe(true);
    expect(db.chats.find((c) => c.id === "c-alice")?.name).toBe("renamed");

    expect(await deleteChat(ALICE, "c-alice")).toBe(true);
    expect(db.chats.some((c) => c.id === "c-alice")).toBe(false);
  });

  it("cascades messages when the chat goes", async () => {
    await deleteChat(ALICE, "c-alice");

    expect(db.messages.map((m) => m.id)).toEqual(["m-bob"]);
  });

  it("moves a chat to the top of the sidebar when a message lands", async () => {
    const before = db.chats.find((c) => c.id === "c-alice")!.updatedAt;

    await addMessage(ALICE, "c-alice", { role: "assistant", content: "hi" });

    const after = db.chats.find((c) => c.id === "c-alice")!.updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("deletes its own message and leaves the rest alone", async () => {
    expect(await deleteMessage(ALICE, "c-alice", "m-1")).toBe(true);
    expect(db.messages.map((m) => m.id).sort()).toEqual(["m-2", "m-bob"]);
  });
});
