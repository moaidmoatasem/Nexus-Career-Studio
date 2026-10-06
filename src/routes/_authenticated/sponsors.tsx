import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { checkSponsorRegister } from "@/lib/sponsor.functions";
import { matchReason } from "@/lib/sponsorship";

export const Route = createFileRoute("/_authenticated/sponsors")({
  head: () => ({
    meta: [
      { title: "UK Sponsor Check — Nexus Career Studio" },
      { name: "description", content: "Check UK visa sponsor licences." },
      { property: "og:title", content: "UK Sponsor Check — Nexus Career Studio" },
      { property: "og:description", content: "Resolve employer names against UK sponsor records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SponsorsPage,
});

type Row = {
  id: number;
  organisation_name: string;
  town_city: string;
  county: string;
  type_rating: string;
  route: string;
  similarity: number;
};

function SponsorsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ms, setMs] = useState(0);
  const [searched, setSearched] = useState("");
  const [checking, setChecking] = useState(false);
  const qc = useQueryClient();
  const check = useServerFn(checkSponsorRegister);
  async function refresh() {
    setChecking(true);
    try {
      const r = await check();
      toast[r.updated ? "success" : "message"](r.message);
      if (r.updated) qc.invalidateQueries({ queryKey: ["sponsor-snapshot"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setChecking(false);
    }
  }
  const snapshot = useQuery({
    queryKey: ["sponsor-snapshot"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsor_snapshots")
        .select("source_url,source_updated_at,row_count,imported_at")
        .eq("status", "active")
        .order("imported_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60_000,
  });
  async function search(term = q) {
    if (!term.trim()) return;
    const t = performance.now();
    const { data } = await supabase.rpc("match_sponsor_company_v3", { search_term: term });
    setMs(Math.round(performance.now() - t));
    setSearched(term);
    setRows((data as Row[]) ?? []);
  }
  return (
    <div>
      <PageHeader
        title="UK Sponsor Oracle"
        sub="Search the official Home Office register of licensed Worker and Temporary Worker sponsors."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex max-w-xl gap-2"
      >
        <Input
          placeholder="Company name, e.g. JPMorgan Chase"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit">
          <Search className="h-4 w-4" />
          Check
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {["ARM", "BP", "Meta", "Revolut", "Deep Mind", "JPMorgan Chase"].map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-3 text-xs text-muted-foreground"
            onClick={() => {
              setQ(s);
              search(s);
            }}
          >
            {s}
          </Button>
        ))}
      </div>
      {rows && (
        <div className="mt-6 max-w-3xl">
          <p className="mb-3 font-mono text-xs text-muted-foreground">
            {rows.length} result(s) · round-trip {ms} ms
          </p>
          {rows.length === 0 && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
              No close register match found. Try the employer’s legal company name before drawing a
              conclusion.
            </p>
          )}
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4"
              >
                <div>
                  <p className="font-medium">{r.organisation_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.town_city}, {r.county} · {r.route}
                  </p>
                </div>
                <div className="text-end">
                  <Badge className="bg-success/15 text-success hover:bg-success/15">
                    {r.type_rating}
                  </Badge>
                  <p className="mt-1 max-w-56 text-[11px] text-muted-foreground">
                    {matchReason(r.similarity, searched, r.organisation_name)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-10 max-w-3xl border-t pt-4 text-xs text-muted-foreground">
        <Button size="sm" variant="outline" className="mb-3" onClick={refresh} disabled={checking}>
          <RefreshCw className={checking ? "animate-spin" : ""} />
          {checking ? "Checking GOV.UK…" : "Check for a newer register"}
        </Button>
        <p>
          {snapshot.data
            ? `${snapshot.data.row_count.toLocaleString()} licence entries · source updated ${snapshot.data.source_updated_at ? new Date(snapshot.data.source_updated_at).toLocaleDateString("en-GB") : "recently"}`
            : "Loading register provenance…"}
        </p>
        <p className="mt-1">
          Register membership confirms a sponsor licence, not that a particular vacancy offers
          sponsorship.{" "}
          <a
            className="text-primary underline"
            href={
              snapshot.data?.source_url ??
              "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
            }
            target="_blank"
            rel="noreferrer"
          >
            View the Home Office source
          </a>
          .
        </p>
      </div>
    </div>
  );
}
