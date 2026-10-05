// Nexus optional portal helper. Runs on YOUR server, off by default.
// Claims queued portal_tasks, opens the official form, fills routine fields only,
// screenshots, then stops with status "waiting_for_you". Never submits.
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { ADAPTERS, SENSITIVE, STOP_PATTERNS } from "./adapters.mjs";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
const POLL_MS = Number(process.env.PORTAL_POLL_SECONDS ?? 30) * 1000;

async function profileFor(userId) {
  const [{ data: p }, { data: vault }, { data: u }] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    db.from("vault_items").select("category,title,organization,is_current").eq("user_id", userId),
    db.auth.admin.getUserById(userId),
  ]);
  const [first = "", ...rest] = (p?.full_name ?? "").split(" ");
  const current = (vault ?? []).find((v) => v.category === "experience" && v.is_current);
  return { full_name: p?.full_name ?? "", first_name: first, last_name: rest.join(" "), email: u?.user?.email ?? "", current_company: current?.organization ?? "", linkedin: "" };
}

async function finish(task, patch) {
  await db.from("portal_tasks").update({ ...patch, lease_expires_at: null }).eq("id", task.id);
  await db.from("agent_activity").insert({ user_id: task.user_id, application_id: task.application_id, task_type: "prepare_portal_step", status: patch.status === "failed" ? "failed" : "needs_you", summary: patch.status === "failed" ? `Portal helper failed: ${patch.error}` : `Portal prepared (${(patch.filled_fields ?? []).length} routine fields). ${patch.stop_reason}`, policy: "portal_worker", detail: { adapter: task.adapter } });
}

async function run(task, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(task.portal_url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const body = (await page.textContent("body")) ?? "";
    const stop = STOP_PATTERNS.find((s) => s.re.test(body));
    const adapter = ADAPTERS[task.adapter] ?? ADAPTERS.generic;
    const values = await profileFor(task.user_id);
    const filled = [];
    if (!stop) {
      for (const [label, field] of Object.entries(adapter.fields)) {
        const value = values[field]; if (!value) continue;
        const input = page.getByLabel(new RegExp(`^\\s*${label}\\b`, "i")).first();
        if (!(await input.count())) continue;
        const accessible = (await input.getAttribute("aria-label")) ?? label;
        if (SENSITIVE.test(accessible)) continue;
        if (await input.inputValue().catch(() => "")) continue; // never overwrite
        await input.fill(value); filled.push(label);
      }
    }
    const shot = await page.screenshot({ fullPage: false });
    const path = `${task.user_id}/${task.id}.png`;
    await db.storage.from("portal-screenshots").upload(path, shot, { contentType: "image/png", upsert: true });
    await finish(task, { status: "waiting_for_you", filled_fields: filled, screenshot_path: path,
      stop_reason: stop?.reason ?? adapter.note ?? "Upload your approved resume, answer remaining questions and submit yourself." });
  } catch (e) {
    await finish(task, { status: "failed", error: String(e?.message ?? e).slice(0, 300) });
  } finally { await page.close(); }
}

const browser = await chromium.launch({ headless: true });
console.log("Nexus portal helper running");
for (;;) {
  const { data, error } = await db.rpc("claim_portal_task", { lease_seconds: 300 });
  if (error) console.error("claim failed", error.message);
  const task = data?.[0];
  if (task) { console.log("task", task.id, task.adapter); await run(task, browser); continue; }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
