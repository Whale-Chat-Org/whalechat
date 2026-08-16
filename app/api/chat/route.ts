import { errorResponse, getSessionUserId } from "@/lib/api-server";
import { CHAT_COMPLETIONS_URL, TEMPERATURE, resolveModel } from "@/lib/deepseek";
import { getOnboardingState } from "@/lib/onboarding";
import { ChatContextMessage } from "@/types/chat";

/** The body the browser posts: a whole conversation, plus which model gets it. */
interface ChatRequest {
  model?: string;
  messages?: ChatContextMessage[];
}

/**
 * Thin proxy to DeepSeek. This is the only place DEEPSEEK_API_KEY is read, so
 * the key never reaches the browser.
 *
 * @remarks max_tokens is deliberately omitted — leaving it unset lets the model
 * run to its own limit, which is what we want.
 */
export async function POST(req: Request) {
  // Nobody should be able to spend the API key on an instance that has not been
  // set up — there is no administrator yet to have granted them anything.
  const onboarding = await getOnboardingState();
  if (onboarding.step !== "done") {
    return errorResponse("This instance has not been set up yet", 503);
  }

  // Spending the API key deserves a validated session, not proxy.ts's cookie
  // check — see the remarks on getSessionUserId.
  const userId = await getSessionUserId();
  if (!userId) return errorResponse("Not authenticated", 401);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "DEEPSEEK_API_KEY is not set. Add it to .env.local and restart the server.",
      500
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body.messages?.length) {
    return errorResponse("No messages provided", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolveModel(body.model),
        messages: body.messages,
        temperature: TEMPERATURE,
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return errorResponse(`Could not reach DeepSeek: ${detail}`, 502);
  }

  if (!upstream.ok) {
    return errorResponse(
      `DeepSeek error ${upstream.status}: ${await upstream.text()}`,
      upstream.status
    );
  }

  const data = await upstream.json();

  return Response.json({
    content: data.choices?.[0]?.message?.content ?? "No response",
    tokenCount: data.usage?.total_tokens,
  });
}
