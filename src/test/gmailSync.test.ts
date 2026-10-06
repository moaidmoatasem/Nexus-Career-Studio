// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Mail = {
  id: string;
  from: string;
  subject: string;
  body: string;
  labels?: string[];
  failFull?: boolean;
};

const h = vi.hoisted(() => {
  // ---- an in-memory stand-in for the supabase-js calls the sync makes ----
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {};
  const KEYS: Record<string, string[]> = {
    gmail_sync_state: ["user_id"],
    processed_mail_messages: ["user_id", "provider", "provider_message_id"],
    unmatched_mail_messages: ["user_id", "provider", "provider_message_id"],
    source_connections: ["user_id", "source"],
  };

  class Query implements PromiseLike<{ data: unknown; error: null }> {
    private filters: Array<(r: Row) => boolean> = [];
    private run: () => unknown = () => null;
    private single = false;
    constructor(private table: string) {
      tables[table] ??= [];
    }
    select() {
      this.run = () => tables[this.table]!.filter((r) => this.filters.every((f) => f(r)));
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push((r) => r[column] === value);
      return this;
    }
    in(column: string, values: unknown[]) {
      this.filters.push((r) => values.includes(r[column]));
      return this;
    }
    maybeSingle() {
      this.single = true;
      return this;
    }
    insert(row: Row) {
      this.run = () => void tables[this.table]!.push({ ...row });
      return this;
    }
    upsert(row: Row, opts?: { onConflict?: string }) {
      this.run = () => {
        const keys = opts?.onConflict?.split(",") ?? KEYS[this.table] ?? [];
        const existing = tables[this.table]!.find((r) => keys.every((k) => r[k] === row[k]));
        if (existing) Object.assign(existing, row);
        else tables[this.table]!.push({ ...row });
      };
      return this;
    }
    update(patch: Row) {
      this.run = () =>
        tables[this.table]!.filter((r) => this.filters.every((f) => f(r))).forEach((r) =>
          Object.assign(r, patch),
        );
      return this;
    }
    then<T1, T2>(
      onfulfilled?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((e: unknown) => T2 | PromiseLike<T2>) | null,
    ) {
      const result = this.run();
      const data = this.single ? ((result as Row[] | null)?.[0] ?? null) : result;
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
    }
  }
  const fakeAdmin = { from: (table: string) => new Query(table) };

  // ---- a fixture mailbox behind Gmail's HTTP API ----
  const state: { mailbox: Mail[] } = { mailbox: [] };
  const fullFetches: string[] = [];
  const metadataFetches: string[] = [];
  const b64 = (text: string) => Buffer.from(text).toString("base64url");
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  class GmailReconnectError extends Error {}
  const gmailFetch = async (_user: string, path: string) => {
    if (path.startsWith("/gmail/v1/users/me/profile"))
      return json({ historyId: "900", emailAddress: "me@example.com" });
    if (path.startsWith("/gmail/v1/users/me/messages?"))
      return json({ messages: state.mailbox.map((m) => ({ id: m.id })) });
    const match = /\/messages\/([^?]+)\?format=(metadata|full)/.exec(path);
    const mail = state.mailbox.find((m) => m.id === match?.[1]);
    if (!match || !mail) return json({}, 404);
    const headers = [
      { name: "From", value: mail.from },
      { name: "Subject", value: mail.subject },
    ];
    if (match[2] === "metadata") {
      metadataFetches.push(mail.id);
      return json({ id: mail.id, labelIds: mail.labels ?? ["INBOX"], payload: { headers } });
    }
    fullFetches.push(mail.id);
    if (mail.failFull) return json({}, 500);
    return json({
      id: mail.id,
      historyId: "901",
      internalDate: "1790000000000",
      snippet: mail.body.slice(0, 50),
      payload: { mimeType: "text/plain", headers, body: { data: b64(mail.body) } },
    });
  };
  return {
    tables,
    state,
    fullFetches,
    metadataFetches,
    fakeAdmin,
    GmailReconnectError,
    gmailFetch,
  };
});
vi.mock("../server/gmailApi.server", () => ({
  GmailReconnectError: h.GmailReconnectError,
  hasGmailConnection: async () => true,
  gmailFetch: h.gmailFetch,
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: h.fakeAdmin }));
const { tables, state, fullFetches, metadataFetches } = h;

const classify = vi.fn();
vi.mock("@/lib/email-classifier.server", async (original) => ({
  ...(await original<typeof import("@/lib/email-classifier.server")>()),
  classifyRecruitmentEmail: (...args: unknown[]) => classify(...args),
}));
const extractAlertLeads = vi.fn();
vi.mock("@/lib/alertLeads.server", () => ({
  extractAlertLeads: (...args: unknown[]) => extractAlertLeads(...args),
}));

import { AiError } from "@/lib/ai.server";
import { PAUSED_MESSAGE, syncGmailForUser } from "@/server/gmailSync.server";

const USER = "user-1";
const INFORMATIONAL = {
  status: "informational",
  company_name: "",
  confidence: 0.9,
  scheduling_url: null,
  action_summary: "",
};
const INTERVIEW = {
  status: "interview_invite",
  company_name: "Initech",
  confidence: 0.95,
  scheduling_url: null,
  action_summary: "Interview invite",
};

const PERSONAL: Mail[] = [
  {
    id: "p1",
    from: "Mum <mum@example.org>",
    subject: "Dinner on Sunday?",
    body: "Roast at 6, bring the dessert.",
  },
  {
    id: "p2",
    from: "Bank <noreply@bank.example>",
    subject: "Your statement",
    body: "Your October statement is ready to view.",
  },
  {
    id: "p3",
    from: "Shop <deals@shop.example>",
    subject: "Interview outfits: 30% off",
    body: "Big sale this weekend only, all suits.",
    labels: ["CATEGORY_PROMOTIONS"],
  },
];

const row = (id: string) =>
  tables["processed_mail_messages"]!.find((r) => r["provider_message_id"] === id);

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables["applications"] = [
    {
      id: "app-1",
      user_id: USER,
      job_id: "job-1",
      status: "applied",
      applied_at: null,
      jobs: { company_name: "Initech", title: "Platform Engineer" },
    },
  ];
  state.mailbox = [];
  fullFetches.length = 0;
  metadataFetches.length = 0;
  classify.mockReset();
  classify.mockResolvedValue(INFORMATIONAL);
  extractAlertLeads.mockReset();
  extractAlertLeads.mockResolvedValue([]);
});

describe("inbox sync minimisation", () => {
  it("never reads, classifies or stores personal mail, keeping only its id", async () => {
    state.mailbox = [
      ...PERSONAL,
      {
        id: "r1",
        from: "Initech Recruiting <jobs@initech.example>",
        subject: "Interview invitation: Platform Engineer",
        body: "We would like to invite you to interview for the Platform Engineer role at Initech.",
      },
    ];
    classify.mockResolvedValue(INTERVIEW);
    const result = await syncGmailForUser(USER);
    expect(result).toMatchObject({ ok: true, checked: 4, skipped: 3 });
    expect(fullFetches).toEqual(["r1"]);
    expect(classify).toHaveBeenCalledTimes(1);
    for (const id of ["p1", "p2", "p3"]) {
      expect(row(id)).toMatchObject({
        status: "skipped",
        sender: "",
        subject: "",
        classification: null,
      });
    }
    expect(row("p3")!["skip_reason"]).toBe("promotions_or_social");
    expect(row("p1")!["skip_reason"]).toBe("not_recruitment");
    // No personal text anywhere in what was stored.
    const stored = JSON.stringify(tables);
    for (const secret of ["Roast at 6", "mum@example.org", "October statement", "Dinner on Sunday"])
      expect(stored).not.toContain(secret);
  });

  it("does not look at skipped mail again on the next sync", async () => {
    state.mailbox = [...PERSONAL];
    await syncGmailForUser(USER);
    const first = metadataFetches.length;
    await syncGmailForUser(USER);
    expect(metadataFetches.length).toBe(first);
  });

  it("keeps informational mail out of the review queue but queues mail that needs a decision", async () => {
    state.mailbox = [
      {
        id: "i1",
        from: "Initech <hr@initech.example>",
        subject: "Your application: office closed on Friday",
        body: "Our office is closed on Friday. Thank you for your patience with your application.",
      },
      {
        id: "i2",
        from: "Globex Hiring <jobs@globex.example>",
        subject: "Interview invitation",
        body: "We would like to invite you to an interview next week for a role you did not apply through Nexus.",
      },
    ];
    classify.mockImplementation(async (input: { subject: string }) =>
      input.subject.startsWith("Interview")
        ? { ...INTERVIEW, company_name: "Globex" }
        : INFORMATIONAL,
    );
    await syncGmailForUser(USER);
    const queued = tables["unmatched_mail_messages"] ?? [];
    expect(queued.map((r) => r["provider_message_id"])).toEqual(["i2"]);
    expect(row("i1")).toMatchObject({ status: "processed", classification: "informational" });
  });

  it("does not run the recruiter classifier on job-alert mail", async () => {
    state.mailbox = [
      {
        id: "a1",
        from: "LinkedIn Job Alerts <jobs-noreply@linkedin.com>",
        subject: "New jobs for you",
        body: "Senior Data Engineer at Acme https://www.linkedin.com/jobs/view/3912345678",
      },
    ];
    await syncGmailForUser(USER);
    expect(classify).not.toHaveBeenCalled();
    expect(extractAlertLeads).toHaveBeenCalledTimes(1);
    expect(row("a1")).toMatchObject({ status: "processed", source_kind: "linkedin_alert" });
  });
});

describe("one bad message never blocks the sync", () => {
  it("skips a message that keeps failing after three attempts and still syncs the rest", async () => {
    state.mailbox = [
      {
        id: "bad",
        from: "Initech <hr@initech.example>",
        subject: "Interview invitation",
        body: "A message Gmail cannot deliver in full.",
        failFull: true,
      },
      {
        id: "good",
        from: "Initech <hr@initech.example>",
        subject: "Next steps for your application",
        body: "Thank you for applying. We will be in touch about next steps.",
      },
    ];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await syncGmailForUser(USER);
      expect(result.ok).toBe(true);
      expect(row("good")).toMatchObject({ status: "processed" });
      expect(row("bad")).toMatchObject({
        status: attempt < 3 ? "failed" : "skipped",
        attempts: attempt,
      });
    }
    expect(row("bad")!["skip_reason"]).toMatch(/failed 3 times/);
    const before = fullFetches.filter((id) => id === "bad").length;
    await syncGmailForUser(USER);
    expect(fullFetches.filter((id) => id === "bad").length).toBe(before);
    expect(tables["gmail_sync_state"]![0]).toMatchObject({ status: "ready", last_error: null });
  });

  it("does not let one message the classifier rejects fail every later sync", async () => {
    state.mailbox = [
      {
        id: "m1",
        from: "Initech <hr@initech.example>",
        subject: "Interview invitation",
        body: "Please pick a time to interview with us.",
      },
      {
        id: "m2",
        from: "Initech <hr@initech.example>",
        subject: "Next steps",
        body: "Thank you for applying, here are the next steps.",
      },
    ];
    classify.mockImplementation(async (input: { subject: string }) => {
      if (input.subject === "Interview invitation")
        throw new AiError("The AI returned an unexpected shape.", 502);
      return INFORMATIONAL;
    });
    for (let i = 0; i < 3; i++) expect((await syncGmailForUser(USER)).ok).toBe(true);
    expect(row("m1")).toMatchObject({ status: "skipped", attempts: 3 });
    expect(row("m2")).toMatchObject({ status: "processed" });
  });

  it("still stops and pauses when the AI provider rejects the key", async () => {
    state.mailbox = [
      {
        id: "k1",
        from: "Initech <hr@initech.example>",
        subject: "Interview invitation",
        body: "Please pick a time to interview with us.",
      },
    ];
    classify.mockRejectedValue(
      new AiError("The AI provider rejected the API key or model access.", 403),
    );
    await expect(syncGmailForUser(USER)).rejects.toBeInstanceOf(AiError);
    expect(tables["gmail_sync_state"]![0]).toMatchObject({ status: "paused" });
    expect(row("k1")).toBeUndefined();
  });
});

describe("scam signals", () => {
  const INVITE =
    "We would like to invite you to interview for the Platform Engineer role at Initech.";
  const application = () => tables["applications"]![0]!;

  it("lets ordinary employer mail move the application (the control case)", async () => {
    state.mailbox = [
      {
        id: "ok",
        from: "Initech Recruiting <jobs@initech.example>",
        subject: "Interview invitation: Platform Engineer",
        body: INVITE,
      },
    ];
    classify.mockResolvedValue(INTERVIEW);
    await syncGmailForUser(USER);
    expect(application()["status"]).toBe("interviewing");
    expect(tables["unmatched_mail_messages"] ?? []).toEqual([]);
  });

  it("never moves an application for free-mail mail that names the employer and role", async () => {
    state.mailbox = [
      {
        id: "free",
        from: "Initech Recruiting <initech.recruiting@gmail.com>",
        subject: "Interview invitation: Platform Engineer",
        body: INVITE,
      },
    ];
    classify.mockResolvedValue(INTERVIEW);
    await syncGmailForUser(USER);
    expect(application()["status"]).toBe("applied");
    const [queued] = tables["unmatched_mail_messages"]!;
    expect(queued).toMatchObject({ provider_message_id: "free", possible_scam: true });
    expect(String(queued!["match_reason"])).toMatch(/free-mail address \(gmail\.com\)/);
  });

  it("flags a request for a fee or visa payment even from a look-alike employer address", async () => {
    state.mailbox = [
      {
        id: "fee",
        from: "Initech HR <hr@initech-careers.example>",
        subject: "Job offer: Platform Engineer at Initech",
        body: `${INVITE} To secure your place, pay the visa processing fee of $300 by Western Union today.`,
      },
    ];
    classify.mockResolvedValue({ ...INTERVIEW, status: "offer" });
    await syncGmailForUser(USER);
    expect(application()["status"]).toBe("applied");
    const [queued] = tables["unmatched_mail_messages"]!;
    expect(queued).toMatchObject({ provider_message_id: "fee", possible_scam: true });
    expect(String(queued!["match_reason"])).toMatch(/asks for a fee/);
  });

  it("does not flag a friend's free-mail message the classifier calls informational", async () => {
    state.mailbox = [
      {
        id: "friend",
        from: "Sam <sam@gmail.com>",
        subject: "Interview tips",
        body: "Some tips for your interview next week, good luck!",
      },
    ];
    classify.mockResolvedValue(INFORMATIONAL);
    await syncGmailForUser(USER);
    expect(tables["unmatched_mail_messages"] ?? []).toEqual([]);
  });
});

describe("a paused sync recovers", () => {
  const MAIL: Mail = {
    id: "k1",
    from: "Initech <hr@initech.example>",
    subject: "Interview invitation",
    body: "Please pick a time to interview with us.",
  };
  const stateRow = () => tables["gmail_sync_state"]![0]!;
  const pause = async () => {
    state.mailbox = [MAIL];
    classify.mockRejectedValueOnce(new AiError("The AI provider rejected the API key.", 403));
    await expect(syncGmailForUser(USER)).rejects.toBeInstanceOf(AiError);
  };

  it("pauses with a plain reason that the connection shows", async () => {
    await pause();
    expect(stateRow()).toMatchObject({ status: "paused", last_error: PAUSED_MESSAGE });
    expect(typeof stateRow()["paused_at"]).toBe("string");
    expect(PAUSED_MESSAGE).toMatch(/rejected the key or is out of credits/);
    expect(tables["source_connections"]![0]).toMatchObject({
      source: "gmail",
      status: "needs_attention",
      last_error: PAUSED_MESSAGE,
    });
  });

  it("stays paused, without calling the AI, until a day has passed", async () => {
    await pause();
    classify.mockClear();
    const quiet = await syncGmailForUser(USER, 25, { retryPausedAfterMs: 24 * 3600_000 });
    expect(quiet).toMatchObject({ ok: false, paused: true, error: PAUSED_MESSAGE });
    expect(await syncGmailForUser(USER)).toMatchObject({ ok: false, paused: true });
    expect(classify).not.toHaveBeenCalled();
  });

  it("is retried by the agent after a day and the pause clears on success", async () => {
    await pause();
    stateRow()["paused_at"] = new Date(Date.now() - 25 * 3600_000).toISOString();
    classify.mockResolvedValue(INFORMATIONAL);
    const result = await syncGmailForUser(USER, 25, { retryPausedAfterMs: 24 * 3600_000 });
    expect(result.ok).toBe(true);
    expect(stateRow()).toMatchObject({ status: "ready", last_error: null, paused_at: null });
    expect(tables["source_connections"]!.find((r) => r["source"] === "gmail")).toMatchObject({
      status: "ready",
      last_error: null,
    });
  });

  it("is retried at once by Check inbox now", async () => {
    await pause();
    classify.mockResolvedValue(INFORMATIONAL);
    const result = await syncGmailForUser(USER, 20, { manual: true });
    expect(result.ok).toBe(true);
    expect(stateRow()).toMatchObject({ status: "ready", paused_at: null });
  });

  it("starts the daily clock again when the retry fails too", async () => {
    await pause();
    stateRow()["paused_at"] = new Date(Date.now() - 25 * 3600_000).toISOString();
    classify.mockRejectedValue(new AiError("The AI provider rejected the API key.", 403));
    await expect(
      syncGmailForUser(USER, 25, { retryPausedAfterMs: 24 * 3600_000 }),
    ).rejects.toBeInstanceOf(AiError);
    expect(Date.now() - Date.parse(String(stateRow()["paused_at"]))).toBeLessThan(60_000);
    expect(await syncGmailForUser(USER, 25, { retryPausedAfterMs: 24 * 3600_000 })).toMatchObject({
      paused: true,
    });
  });
});
