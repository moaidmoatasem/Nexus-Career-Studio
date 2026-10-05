import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import type { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Streams a structured Responses call and returns the final parsed object. */
export async function generateStructured<T>(opts: { instructions: string; prompt: string; schema: z.ZodType<T> }): Promise<T> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new AiError("AI is not configured.", 401);
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!res.ok) {
        const body = await res.clone().text();
        console.error("AI gateway error", res.status, body);
        if (res.status === 429) throw new AiError("AI is busy right now. Please try again in a minute.", 429);
        if (res.status === 402) throw new AiError("Your workspace is out of AI credits. Add credits in Settings → Plans & credits.", 402);
        if (res.status === 403) throw new AiError("AI access is blocked for this workspace.", 403);
      }
      return res;
    },
  });
  let streamError: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    system: opts.instructions,
    prompt: opts.prompt,
    output: Output.object({ schema: opts.schema }),
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return (await result.output) as T;
  } catch (e) {
    const err = streamError ?? e;
    if (err instanceof AiError) throw err;
    const cause = (err as { cause?: unknown })?.cause;
    if (cause instanceof AiError) throw cause;
    console.error("AI call failed", err);
    throw new AiError("The AI could not complete this request.", 500);
  }
}
