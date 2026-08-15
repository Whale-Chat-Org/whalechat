/**
 * Single source of truth for the DeepSeek API and the app's generation settings.
 *
 * The API key is NOT here — it is read server-side only, from DEEPSEEK_API_KEY,
 * in app/api/chat/route.ts. Nothing in this file may reach the browser bundle
 * with a secret in it.
 */

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

/** The models offered in the chat's model picker. */
export const DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;

export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

/** Model assigned to new chats. */
export const DEFAULT_MODEL: DeepSeekModel = "deepseek-v4-flash";

export const CHAT_COMPLETIONS_URL = `${DEEPSEEK_BASE_URL}/chat/completions`;

/**
 * DeepSeek's documented recommendation for general conversation. The API accepts
 * up to 2, but output degrades badly above ~1.5.
 */
export const TEMPERATURE = 1.3;

/** System prompt applied to new chats, and to any chat left blank. */
export const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

/** Name a chat carries until its first message retitles it. */
export const NEW_CHAT_NAME = "New Chat";

/**
 * Chats created before the v4 model rename carry retired ids such as
 * "deepseek-chat". Fall back to the default rather than letting DeepSeek reject
 * the request with an opaque 400.
 */
export function resolveModel(model: string | undefined): string {
  return DEEPSEEK_MODELS.includes(model as DeepSeekModel)
    ? model!
    : DEFAULT_MODEL;
}
