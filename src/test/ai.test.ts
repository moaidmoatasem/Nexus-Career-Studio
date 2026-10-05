// @vitest-environment node
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { AiError, generateStructured, parseJsonReply } from "@/lib/ai.server";

// A tiny OpenAI-compatible server: each test sets how it answers.
type Handler = (body: Record<string, unknown>, req: IncomingMessage) => { status: number; json: unknown };
let handler: Handler = () => ({ status: 500, json: {} });
const seen: Array<Record<string, unknown>> = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}") as Record<string, unknown>;
      seen.push({ ...body, _path: req.url, _auth: req.headers.authorization ?? null });
      const out = handler(body, req);
      res.writeHead(out.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out.json));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env["AI_BASE_URL"] = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/`;
  process.env["AI_MODEL"] = "test-model";
  process.env["AI_API_KEY"] = "test-key";
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => { seen.length = 0; delete process.env["AI_RESPONSE_FORMAT"]; });

const schema = z.object({ status: z.enum(["offer", "rejection"]), confidence: z.number() });
const reply = (content: string) => ({ status: 200, json: { choices: [{ message: { role: "assistant", content } }] } });

describe("generateStructured", () => {
  it("calls /chat/completions with the model, key and a JSON schema, and validates the reply", async () => {
    handler = () => reply('{"status":"offer","confidence":0.9}');
    await expect(generateStructured({ instructions: "Classify.", prompt: "We'd like to offer you the role.", schema })).resolves.toEqual({ status: "offer", confidence: 0.9 });
    const req = seen[0]!;
    expect(req["_path"]).toBe("/v1/chat/completions");
    expect(req["_auth"]).toBe("Bearer test-key");
    expect(req["model"]).toBe("test-model");
    expect((req["response_format"] as { type: string }).type).toBe("json_schema");
    expect(req).not.toHaveProperty("temperature"); // reasoning models reject custom temperatures
  });
  it("falls back to JSON mode when the provider has no structured outputs", async () => {
    handler = (body) =>
      (body["response_format"] as { type: string }).type === "json_schema"
        ? { status: 400, json: { error: { message: "response_format json_schema is not supported by this model" } } }
        : reply('{"status":"rejection","confidence":0.8}');
    await expect(generateStructured({ instructions: "Classify.", prompt: "Unfortunately…", schema })).resolves.toEqual({ status: "rejection", confidence: 0.8 });
    expect(seen.map((r) => (r["response_format"] as { type: string }).type)).toEqual(["json_schema", "json_object"]);
  });
  it("accepts fenced replies and drops <think> blocks", async () => {
    handler = () => reply('<think>hmm</think>\n```json\n{"status":"offer","confidence":1}\n```');
    await expect(generateStructured({ instructions: "x", prompt: "y", schema })).resolves.toEqual({ status: "offer", confidence: 1 });
  });
  it("maps provider errors to clear messages", async () => {
    handler = () => ({ status: 401, json: { error: { message: "bad key" } } });
    await expect(generateStructured({ instructions: "x", prompt: "y", schema })).rejects.toMatchObject({ status: 403 });
    handler = () => ({ status: 429, json: {} });
    await expect(generateStructured({ instructions: "x", prompt: "y", schema })).rejects.toMatchObject({ status: 429 });
  });
  it("rejects replies that don't match the schema", async () => {
    handler = () => reply('{"status":"maybe","confidence":"high"}');
    await expect(generateStructured({ instructions: "x", prompt: "y", schema })).rejects.toBeInstanceOf(AiError);
  });
  it("works without an API key for local servers and honours AI_RESPONSE_FORMAT", async () => {
    const key = process.env["AI_API_KEY"];
    delete process.env["AI_API_KEY"];
    process.env["AI_RESPONSE_FORMAT"] = "none";
    handler = () => reply('{"status":"offer","confidence":0.5}');
    await generateStructured({ instructions: "x", prompt: "y", schema });
    expect(seen[0]?.["_auth"]).toBeNull();
    expect(seen[0]).not.toHaveProperty("response_format");
    process.env["AI_API_KEY"] = key;
  });
  it("explains when AI is not configured", async () => {
    const base = process.env["AI_BASE_URL"];
    delete process.env["AI_BASE_URL"];
    await expect(generateStructured({ instructions: "x", prompt: "y", schema })).rejects.toMatchObject({ status: 503 });
    process.env["AI_BASE_URL"] = base;
  });
});

describe("parseJsonReply", () => {
  it("finds the object inside surrounding prose", () => {
    expect(parseJsonReply('Here you go: {"a":1} — done')).toEqual({ a: 1 });
  });
});
