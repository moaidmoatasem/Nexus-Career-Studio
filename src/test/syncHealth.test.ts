// @vitest-environment node
import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, syncWarnings, type SyncHealth } from "@/lib/syncHealth";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3600_000;

const healthy = (): SyncHealth => ({
  gmail: {
    connected: true,
    status: "ready",
    lastSuccessAt: ago(HOUR),
    since: ago(30 * 24 * HOUR),
    lastError: null,
  },
  scheduler: { enabled: true, lastRunAt: ago(10 * 60_000), since: ago(30 * 24 * HOUR) },
});

describe("syncWarnings", () => {
  it("is quiet when both are working", () => {
    expect(syncWarnings(healthy(), NOW)).toEqual([]);
  });

  it("warns when Gmail hasn't succeeded for more than a day", () => {
    const h = healthy();
    h.gmail.lastSuccessAt = ago(STALE_AFTER_MS + HOUR);
    expect(syncWarnings(h, NOW).map((w) => w.kind)).toEqual(["gmail"]);
    h.gmail.lastSuccessAt = ago(STALE_AFTER_MS - HOUR);
    expect(syncWarnings(h, NOW)).toEqual([]);
  });

  it("notices a Gmail sync that has never succeeded", () => {
    const h = healthy();
    h.gmail.lastSuccessAt = null;
    h.gmail.since = ago(2 * 24 * HOUR);
    expect(syncWarnings(h, NOW).map((w) => w.kind)).toEqual(["gmail"]);
    h.gmail.since = ago(HOUR);
    expect(syncWarnings(h, NOW)).toEqual([]);
  });

  it("shows the plain reason when Gmail is paused, however recent the last success", () => {
    const h = healthy();
    h.gmail.status = "paused";
    h.gmail.lastError = "The AI provider rejected the key or is out of credits.";
    expect(syncWarnings(h, NOW)).toEqual([
      { kind: "gmail", message: "The AI provider rejected the key or is out of credits." },
    ]);
  });

  it("says nothing about Gmail when it isn't connected", () => {
    const h = healthy();
    h.gmail = { connected: false, status: null, lastSuccessAt: null, since: null, lastError: null };
    expect(syncWarnings(h, NOW)).toEqual([]);
  });

  it("warns when the scheduler is on but hasn't run for a day", () => {
    const h = healthy();
    h.scheduler.lastRunAt = ago(26 * HOUR);
    expect(syncWarnings(h, NOW).map((w) => w.kind)).toEqual(["scheduler"]);
  });

  it("does not warn about a scheduler the user hasn't turned on", () => {
    const h = healthy();
    h.scheduler = { enabled: false, lastRunAt: null, since: ago(30 * 24 * HOUR) };
    expect(syncWarnings(h, NOW)).toEqual([]);
  });

  it("reports both problems together", () => {
    const h = healthy();
    h.gmail.lastSuccessAt = ago(3 * 24 * HOUR);
    h.scheduler.lastRunAt = ago(3 * 24 * HOUR);
    expect(syncWarnings(h, NOW).map((w) => w.kind)).toEqual(["gmail", "scheduler"]);
  });
});
