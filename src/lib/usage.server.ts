// Daily per-user caps on the calls that cost the instance owner money. Empty or invalid
// AI_DAILY_LIMIT / FIRECRAWL_DAILY_LIMIT means unlimited and makes no database call.
import { UsageLimitError } from "./ai.server";

export type UsageKind = "ai" | "firecrawl";

const ENV: Record<UsageKind, string> = {
  ai: "AI_DAILY_LIMIT",
  firecrawl: "FIRECRAWL_DAILY_LIMIT",
};
const LABEL: Record<UsageKind, string> = { ai: "AI", firecrawl: "Firecrawl" };

/** A positive whole number, or null for "no limit". */
export function parseLimit(raw: string | undefined | null): number | null {
  const text = (raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n > 0 ? n : null;
}

export function limitMessage(kind: UsageKind): string {
  return `Daily ${LABEL[kind]} limit reached; it resets at midnight UTC.`;
}

/** Counts one call for this user, or throws UsageLimitError (status 429) when the day's cap is used up. */
export async function consumeUsage(userId: string, kind: UsageKind): Promise<void> {
  const limit = parseLimit(process.env[ENV[kind]]);
  if (limit === null) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_usage", {
    p_user: userId,
    p_kind: kind,
    p_limit: limit,
  });
  if (error) throw new Error(`Could not check the daily ${LABEL[kind]} limit: ${error.message}`);
  if (!data) throw new UsageLimitError(limitMessage(kind));
}
