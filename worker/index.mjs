// Nexus optional portal helper. Runs on YOUR server, off by default.
// Claims queued portal_tasks, opens the official form, fills routine fields only,
// screenshots, then stops with status "waiting_for_you". Never submits.
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { ADAPTERS, SENSITIVE, STOP_PATTERNS } from "./adapters.mjs";
import { checkUrl } from "./urlGuard.mjs";

const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const POLL_MS = Number(process.env.PORTAL_POLL_SECONDS ?? 30) * 1000;
// Optional: comma-separated domains the helper may open, e.g. "lever.co,greenhouse.io,myworkdayjobs.com".
const ALLOWED_HOSTS = (process.env.PORTAL_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function profileFor(userId) {
  const [{ data: p }, { data: vault }, { data: u }] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    db
      .from("vault_items")
      .select("category,title,organization,is_current")
      .eq("user_id", userId)
      .eq("is_verified", true),
    db.auth.admin.getUserById(userId),
  ]);
  const [first = "", ...rest] = (p?.full_name ?? "").split(" ");
  const current = (vault ?? []).find((v) => v.category === "experience" && v.is_current);
  return {
    full_name: p?.full_name ?? "",
    first_name: first,
    last_name: rest.join(" "),
    email: u?.user?.email ?? "",
    current_company: current?.organization ?? "",
    linkedin: "",
  };
}

async function finish(task, patch) {
  // Only a task still marked running is updated, so a user's cancel is never overwritten.
  const { data: updated } = await db
    .from("portal_tasks")
    .update({ ...patch, lease_expires_at: null })
    .eq("id", task.id)
    .eq("status", "running")
    .select("id");
  if (!updated?.length) return;
  await db.from("agent_activity").insert({
    user_id: task.user_id,
    application_id: task.application_id,
    task_type: "prepare_portal_step",
    status: patch.status === "failed" ? "failed" : "needs_you",
    summary:
      patch.status === "failed"
        ? `Portal helper failed: ${patch.error}`
        : `Portal prepared (${(patch.filled_fields ?? []).length} routine fields). ${patch.stop_reason}`,
    policy: "portal_worker",
    detail: { adapter: task.adapter },
  });
}

/** Per-task cache so each host is resolved and checked once. */
function guardFor() {
  const verdicts = new Map();
  return (target, options) => {
    let origin;
    try {
      origin = new URL(target).origin;
    } catch {
      return Promise.resolve({ ok: false, reason: "Not a valid URL" });
    }
    const cacheKey = `${origin}|${options.allowHttp ? 1 : 0}|${options.allowedHosts?.length ? 1 : 0}`;
    if (!verdicts.has(cacheKey)) verdicts.set(cacheKey, checkUrl(target, options));
    return verdicts.get(cacheKey);
  };
}

async function run(task, browser) {
  const guard = guardFor();
  const first = await guard(task.portal_url, { allowedHosts: ALLOWED_HOSTS });
  if (!first.ok) {
    await finish(task, { status: "failed", error: `Refused to open this link: ${first.reason}` });
    return;
  }
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  // Every request the page makes is checked; anything aimed at an internal address is dropped.
  await context.route("**/*", async (route) => {
    const verdict = await guard(route.request().url(), { allowHttp: true });
    return verdict.ok ? route.continue() : route.abort("blockedbyclient");
  });
  try {
    await page.goto(task.portal_url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    // Redirects are not re-routed by Playwright, so re-check where every frame ended up
    // before anything from the page is captured.
    for (const frame of page.frames()) {
      const frameUrl = frame.url();
      if (!/^https?:/i.test(frameUrl)) continue; // about:blank, srcdoc, data: and blob: frames load nothing from the network
      const isMain = frame === page.mainFrame();
      const verdict = await guard(
        frameUrl,
        isMain ? { allowedHosts: ALLOWED_HOSTS } : { allowHttp: true },
      );
      if (!verdict.ok)
        throw new Error(
          `The page redirected somewhere the helper may not open (${verdict.reason}).`,
        );
    }
    const body = (await page.textContent("body")) ?? "";
    const stop = STOP_PATTERNS.find((s) => s.re.test(body));
    const adapter = ADAPTERS[task.adapter] ?? ADAPTERS.generic;
    const values = await profileFor(task.user_id);
    const filled = [];
    if (!stop) {
      for (const [label, field] of Object.entries(adapter.fields)) {
        const value = values[field];
        if (!value) continue;
        const input = page.getByLabel(new RegExp(`^\\s*${label}\\b`, "i")).first();
        if (!(await input.count())) continue;
        const accessible = (await input.getAttribute("aria-label")) ?? label;
        if (SENSITIVE.test(accessible)) continue;
        if (await input.inputValue().catch(() => "")) continue; // never overwrite
        await input.fill(value);
        filled.push(label);
      }
    }
    const shot = await page.screenshot({ fullPage: false });
    const path = `${task.user_id}/${task.id}.png`;
    const { error: uploadError } = await db.storage
      .from("portal-screenshots")
      .upload(path, shot, { contentType: "image/png", upsert: true });
    if (uploadError) console.error("screenshot upload failed", uploadError.message);
    await finish(task, {
      status: "waiting_for_you",
      filled_fields: filled,
      screenshot_path: uploadError ? null : path,
      stop_reason:
        stop?.reason ??
        adapter.note ??
        "Upload your approved resume, answer remaining questions and submit yourself.",
    });
  } catch (e) {
    await finish(task, { status: "failed", error: String(e?.message ?? e).slice(0, 300) });
  } finally {
    await context.close();
  }
}

// The browser gets a minimal environment: it never sees the service-role key or other secrets.
const browser = await chromium.launch({
  headless: true,
  env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp" },
});
console.log(
  `Nexus portal helper running${ALLOWED_HOSTS.length ? ` (allowed hosts: ${ALLOWED_HOSTS.join(", ")})` : ""}`,
);
for (;;) {
  const { data, error } = await db.rpc("claim_portal_task", { lease_seconds: 300 });
  if (error) console.error("claim failed", error.message);
  const task = data?.[0];
  if (task) {
    console.log("task", task.id, task.adapter);
    await run(task, browser);
    continue;
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
