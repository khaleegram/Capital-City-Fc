import "server-only"

/**
 * DeepSeek chat-completions, called directly rather than through Genkit.
 *
 * ## Why not Genkit
 *
 * Every other AI flow in this project goes through Genkit, and this one deliberately does not.
 * The reason is a measured one. Asked to create a fixture, Genkit's `ai.generate({ tools })` runs
 * the tool handler itself, feeds the result back, and returns only the model's closing prose —
 * with `toolRequests` empty. The response read *"I've created a friendly fixture... The fixture ID
 * is `fake-malantarki`"*, while carrying no record of the call that produced it.
 *
 * For a chatbot that is a convenience. For an agent that writes to the club's database it is
 * disqualifying: the UI's activity feed is built from the tool calls, so there would be nothing to
 * show, and a tool that failed its arguments would be indistinguishable from one that worked.
 * `returnToolRequests: true` does give Genkit manual control — that variant was verified working —
 * but it then asks me to express the multi-turn assistant/tool-result history through Genkit's
 * part types, which is exactly the translation layer that misbehaved in the first place.
 *
 * So this module speaks the OpenAI wire protocol, which DeepSeek implements, in the shape the agent
 * loop needs: emit `tool_calls`, receive `tool` results, repeat.
 *
 * ## The key stays here
 *
 * This module is `server-only` and reads `DEEPSEEK_API_KEY` from the environment. It is imported
 * by one route handler, which is the only place in the app that reaches the model. Nothing about
 * the key — or the ability to spend against it — is exposed to the browser, which is why the
 * browser does not call the model itself even though it does everything else.
 */

const ENDPOINT = "https://api.deepseek.com/chat/completions"

/** V3. Tool calling is supported by `deepseek-chat`; `deepseek-reasoner` does not support it. */
const MODEL = "deepseek-chat"

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string; tool_calls?: unknown[] }
  | { role: "tool"; content: string; tool_call_id: string }

export type ToolCall = { id: string; name: string; arguments: string }

export type CompletionResult =
  | { kind: "text"; text: string }
  | { kind: "tools"; calls: ToolCall[]; text: string }

export class ModelUnavailable extends Error {}

export function hasModelKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY)
}

/**
 * One turn. Returns either the assistant's final text, or the tool calls it wants run next.
 *
 * Tools are passed in rather than imported so this module stays a transport: it knows nothing
 * about fixtures or news, which keeps the model surface auditable in one place.
 */
export async function completeChat(
  messages: ChatMessage[],
  tools: unknown[],
  opts: { timeoutMs?: number } = {}
): Promise<CompletionResult> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new ModelUnavailable("DEEPSEEK_API_KEY is not configured for this deployment.")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90_000)

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
        // Low but not zero: the writer should be dry and factual, and the agent must not get
        // creative with arguments. Determinism is not achievable through this API anyway.
        temperature: 0.2,
      }),
    })
  } catch (err) {
    throw new ModelUnavailable(
      (err as Error)?.name === "AbortError" ? "DeepSeek took too long to respond." : "Could not reach DeepSeek."
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new ModelUnavailable(
      res.status === 401
        ? "DeepSeek rejected the API key."
        : res.status === 402
          ? "The DeepSeek account is out of credit."
          : res.status === 429
            ? "DeepSeek is rate-limiting requests. Try again shortly."
            : `DeepSeek returned ${res.status}. ${detail.slice(0, 200)}`
    )
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
  }
  const message = json.choices?.[0]?.message
  if (!message) throw new ModelUnavailable("DeepSeek returned an empty response.")

  const text = (message.content ?? "").trim()
  const calls = (message.tool_calls ?? []).map((c) => ({
    id: c.id,
    name: c.function?.name ?? "",
    // Some providers emit an object here rather than a string. Normalising keeps the loop from
    // having to care, and a malformed payload becomes a readable tool error instead of a crash.
    arguments: typeof c.function?.arguments === "string" ? c.function.arguments : JSON.stringify(c.function?.arguments ?? {}),
  }))

  return calls.length ? { kind: "tools", calls, text } : { kind: "text", text }
}
