"use client";
import localforage from "localforage";

/** Chat sessions, keyed by chat id. */
export const chatsDB = localforage.createInstance({
  name: "ai-chatbot",
  storeName: "chats",
});

/** Message arrays, keyed by chat id. */
export const messagesDB = localforage.createInstance({
  name: "ai-chatbot",
  storeName: "messages",
});

