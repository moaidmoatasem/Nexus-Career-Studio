// Structured AI calls against any OpenAI-compatible Chat Completions API: OpenAI, OpenRouter,
// Groq, Mistral, DeepSeek, Google's Gemini OpenAI endpoint, or a local Ollama, vLLM or
// LM Studio server. Configure AI_BASE_URL and AI_MODEL, plus AI_API_KEY for hosted providers.
// Uses only fetch and Web APIs, so it runs on Node, Bun and edge runtimes alike.
import { z } from "zod/v4";

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type ResponseFormat = "json_schema" | "json_object" | "none";
const FORMATS: ResponseFormat[] = ["json_schema", "json_object", "none"];

export interface AiConfig {
  baseUrl: string;
  model: string;
  apiKey: string | null;
  format: ResponseFormat;
  timeoutMs: number;
  reasoningEffort: string | null;
}

/** The configured provider, or null when AI is not set up. */
export function aiConfig(): AiConfig | null {
  const baseUrl = process.env["AI_BASE_URL"]?.trim().replace(/\/+$/, "");
  const model = process.env["AI_MODEL"]?.trim();
  if (!baseUrl || !model) return null;
  const format = (process.env["AI_RESPONSE_FORMAT"]?.trim() || "json_schema") as ResponseFormat;
  const timeoutMs = Number(process.env["AI_TIMEOUT_MS"]);
  return {
    baseUrl,
    model,
    apiKey: process.env["AI_API_KEY"]?.trim() || null,
    format: FORMATS.includes(format) ? format : "json_schema",
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000,
    reasoningEffort: process.env["AI_REASONING_EFFORT"]?.trim() || null,
  };
}

function errorFor(status: number): AiError {
  if (status === 401 || status === 403)
    return new AiError("The AI provider rejected the API key or model access.", 403);
  if (status === 402) return new AiError("The AI provider account is out of credits.", 402);
  if (status === 404)
    return new AiError(
      "The AI model or endpoint was not found. Check AI_BASE_URL and AI_MODEL.",
      404,
    );
  if (status === 429)
    return new AiError("AI is busy or rate-limited right now. Please try again in a minute.", 429);
  return new AiError("The AI could not complete this request.", 502);
}

/** Reads the JSON object out of a reply, tolerating code fences and <think> blocks some models add. */
export function parseJsonReply(content: string): unknown {
  const text = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError("The AI did not return valid JSON. Try again or use a stronger model.", 502);
  }
}

/** Calls the model and returns an object validated against `schema`. */
export async function generateStructured<T>(opts: {
  instructions: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const cfg = aiConfig();
  if (!cfg)
    throw new AiError(
      "AI is not configured. Set AI_BASE_URL and AI_MODEL (and AI_API_KEY for a hosted provider).",
      503,
    );
  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete jsonSchema["$schema"];
  // The schema also goes in the instructions so models that ignore response_format still follow it.
  const system = `${opts.instructions}\n\nReply with a single JSON object only — no prose and no code fences. It must match this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.prompt },
    ],
    ...(cfg.reasoningEffort ? { reasoning_effort: cfg.reasoningEffort } : {}),
  };
  // Providers without structured outputs reject json_schema; fall back to plain JSON mode once.
  const attempts: ResponseFormat[] =
    cfg.format === "json_schema" ? ["json_schema", "json_object"] : [cfg.format];
  for (const [i, format] of attempts.entries()) {
    const responseFormat =
      format === "json_schema"
        ? {
            type: "json_schema",
            json_schema: { name: "result", schema: jsonSchema, strict: false },
          }
        : format === "json_object"
          ? { type: "json_object" }
          : null;
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify(responseFormat ? { ...body, response_format: responseFormat } : body),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new AiError(
        timedOut
          ? "The AI provider took too long to answer."
          : "Could not reach the AI provider. Check AI_BASE_URL.",
        timedOut ? 504 : 502,
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("AI provider error", res.status, detail.slice(0, 500));
      const lastAttempt = i === attempts.length - 1;
      if (
        !lastAttempt &&
        res.status === 400 &&
        /response_format|json_schema|schema|structured/i.test(detail)
      )
        continue;
      throw errorFor(res.status);
    }
    const payload = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: unknown; refusal?: string | null } }>;
    } | null;
    const message = payload?.choices?.[0]?.message;
    if (message?.refusal) throw new AiError("The AI declined this request.", 422);
    const raw = message?.content;
    const content =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw
              .map((part) =>
                typeof part === "object" && part && "text" in part
                  ? String((part as { text: unknown }).text)
                  : "",
              )
              .join("")
          : "";
    const parsed = opts.schema.safeParse(parseJsonReply(content));
    if (!parsed.success) {
      console.error("AI reply did not match the schema", parsed.error.issues.slice(0, 5));
      throw new AiError(
        "The AI returned an answer in an unexpected shape. Try again or use a stronger model.",
        502,
      );
    }
    return parsed.data;
  }
  throw new AiError("The AI could not complete this request.", 502);
}
