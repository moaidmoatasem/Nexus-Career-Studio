// Fetches the official Home Office sponsor register, stages it, validates and activates.
// Idempotent: does nothing when the latest published file is already active.
const SOURCE = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers";
const API = "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers";

// Mirrors public.normalize_company_name so staged rows match SQL lookups.
export function normalizeCompany(raw: string) {
  return (raw || "").toLowerCase()
    .replace(/\b(limited|ltd|plc|llc|inc|incorporated|corp|corporation|group|holdings|services|uk|technologies|tech)\b/g, " ")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ").trim();
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function refreshSponsorRegister() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const meta = await fetch(API).then((r) => { if (!r.ok) throw new Error(`GOV.UK returned ${r.status}`); return r.json() as Promise<{ public_updated_at?: string; details: { attachments?: { url: string; content_type?: string }[] } }>; });
  const csvUrl = meta.details.attachments?.find((a) => a.content_type === "text/csv" || a.url.endsWith(".csv"))?.url;
  if (!csvUrl) throw new Error("The official page has no CSV register attached.");
  const { data: active } = await db.from("sponsor_snapshots").select("attachment_url").eq("status", "active").maybeSingle();
  if (active?.attachment_url === csvUrl) return { updated: false as const, reason: "Already using the latest official register." };

  const csv = await fetch(csvUrl).then((r) => { if (!r.ok) throw new Error(`Register download failed (${r.status})`); return r.text(); });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(csv));
  const checksum = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const [header = [], ...body] = parseCsv(csv);
  const col = (name: RegExp) => header.findIndex((h) => name.test(h));
  const iName = col(/organisation/i), iTown = col(/town/i), iCounty = col(/county/i), iType = col(/type/i), iRoute = col(/route/i);
  if (iName < 0 || iRoute < 0) throw new Error("Register columns changed; refusing to import.");
  const seen = new Set<string>();
  const rows = body.filter((r) => r[iName]?.trim()).map((r) => ({
    organisation_name: r[iName]!.trim(), organisation_normalized: normalizeCompany(r[iName]!),
    town_city: r[iTown]?.trim() ?? "", county: r[iCounty]?.trim() ?? "", type_rating: r[iType]?.trim() ?? "", route: r[iRoute]?.trim() ?? "",
  })).filter((r) => { const k = `${r.organisation_name}|${r.town_city}|${r.route}`; if (seen.has(k)) return false; seen.add(k); return true; });

  const { data: snap, error } = await db.from("sponsor_snapshots").insert({ source_url: SOURCE, attachment_url: csvUrl, source_updated_at: meta.public_updated_at ?? null, checksum, row_count: rows.length, status: "loading" }).select("id").single();
  if (error || !snap) throw new Error(error?.message ?? "Could not create snapshot");
  try {
    for (let i = 0; i < rows.length; i += 5000) {
      const { error: e } = await db.from("sponsor_import_rows").insert(rows.slice(i, i + 5000).map((r) => ({ ...r, snapshot_id: snap.id })));
      if (e) throw new Error(e.message);
    }
    const { data: imported, error: e } = await db.rpc("activate_sponsor_snapshot", { target_snapshot: snap.id });
    if (e) throw new Error(e.message);
    return { updated: true as const, rows: imported as number };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("sponsor_snapshots").update({ status: "failed", error_summary: message.slice(0, 500) }).eq("id", snap.id);
    await db.from("sponsor_import_rows").delete().eq("snapshot_id", snap.id);
    throw e;
  }
}
