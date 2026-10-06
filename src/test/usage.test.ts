// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

import { generateStructured, UsageLimitError } from "@/lib/ai.server";
import { consumeUsage, limitMessage, parseLimit } from "@/lib/usage.server";

const SCHEMA = z.object({ ok: z.boolean() });

beforeEach(() => {
  rpc.mockReset();
  process.env["AI_BASE_URL"] = "http://ai.test/v1";
  process.env["AI_MODEL"] = "m";
});
afterEach(() => {
  for (const k of ["AI_DAILY_LIMIT", "FIRECRAWL_DAILY_LIMIT", "AI_BASE_URL", "AI_MODEL"])
    delete process.env[k];
  vi.restoreAllMocks();
});

describe("parseLimit", () => {
  it("reads a positive whole number and treats everything else as unlimited", () => {
    expect(parseLimit("50")).toBe(50);
    expect(parseLimit(" 7 ")).toBe(7);
    for (const raw of [undefined, null, "", "  ", "0", "-3", "abc", "1.5", "10x"])
      expect(parseLimit(raw)).toBeNull();
  });
});

describe("consumeUsage", () => {
  it("does nothing, without a database call, when no limit is set", async () => {
    await consumeUsage("u1", "ai");
    await consumeUsage("u1", "firecrawl");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("counts a call against the per-user, per-kind cap", async () => {
    process.env["AI_DAILY_LIMIT"] = "3";
    rpc.mockResolvedValue({ data: true, error: null });
    await consumeUsage("u1", "ai");
    expect(rpc).toHaveBeenCalledWith("consume_usage", { p_user: "u1", p_kind: "ai", p_limit: 3 });
  });

  it("fails with a 429 and the reset time once the cap is used up", async () => {
    process.env["FIRECRAWL_DAILY_LIMIT"] = "2";
    rpc.mockResolvedValue({ data: false, error: null });
    const error = await consumeUsage("u1", "firecrawl").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UsageLimitError);
    expect((error as UsageLimitError).status).toBe(429);
    expect((error as UsageLimitError).message).toBe(
      "Daily Firecrawl limit reached; it resets at midnight UTC.",
    );
    expect(limitMessage("ai")).toBe("Daily AI limit reached; it resets at midnight UTC.");
  });

  it("does not let a failing counter silently allow the call", async () => {
    process.env["AI_DAILY_LIMIT"] = "3";
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(consumeUsage("u1", "ai")).rejects.toThrow(/Could not check the daily AI limit/);
  });
});

describe("generateStructured and the AI cap", () => {
  it("refuses over the limit before any request reaches the provider", async () => {
    process.env["AI_DAILY_LIMIT"] = "1";
    rpc.mockResolvedValue({ data: false, error: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      generateStructured({ userId: "u1", instructions: "x", prompt: "y", schema: SCHEMA }),
    ).rejects.toMatchObject({ status: 429, message: expect.stringContaining("Daily AI limit") });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the provider while within the limit", async () => {
    process.env["AI_DAILY_LIMIT"] = "5";
    rpc.mockResolvedValue({ data: true, error: null });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] })),
    );
    await expect(
      generateStructured({ userId: "u1", instructions: "x", prompt: "y", schema: SCHEMA }),
    ).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("the Firecrawl cap", () => {
  it("stops a search over the limit before any request is made", async () => {
    const { searchPublicJobs } = await import("@/lib/discovery.server");
    process.env["FIRECRAWL_API_KEY"] = "k";
    process.env["FIRECRAWL_DAILY_LIMIT"] = "1";
    rpc.mockResolvedValue({ data: false, error: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(searchPublicJobs("u1", "data engineer leeds")).rejects.toBeInstanceOf(
      UsageLimitError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    delete process.env["FIRECRAWL_API_KEY"];
  });
});
