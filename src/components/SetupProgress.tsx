import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Circle } from "lucide-react";
import { useProfile, useSourceConnections, useVault } from "@/lib/data";
import { Button } from "@/components/ui/button";

const steps = [
  { key: "basics", label: "Career basics", to: "/vault" as const },
  { key: "evidence", label: "Career evidence", to: "/vault" as const },
  { key: "preferences", label: "Job preferences", to: "/vault" as const },
  { key: "gmail", label: "Gmail (optional)", to: "/connections" as const },
];

export function SetupProgress() {
  const profile = useProfile();
  const vault = useVault();
  const sources = useSourceConnections();
  const done = {
    basics: Boolean(profile.data?.full_name && profile.data?.headline),
    evidence: Boolean(vault.data?.some((item) => item.is_verified)),
    preferences: Boolean(profile.data?.target_titles.length && profile.data?.target_locations.length),
    gmail: Boolean(sources.data?.some((item) => item.source === "gmail" && item.status === "ready")),
  };
  const requiredDone = [done.basics, done.evidence, done.preferences].filter(Boolean).length;
  if (requiredDone === 3) return null;
  const next = steps.find((step) => step.key !== "gmail" && !done[step.key as keyof typeof done]);

  return (
    <section className="mb-7 border-y bg-card/45 py-5">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Set up your workspace</p>
          <h2 className="mt-1 font-display text-xl font-semibold">{requiredDone} of 3 essentials complete</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {steps.map((step) => {
              const complete = done[step.key as keyof typeof done];
              return <span key={step.key} className={`flex items-center gap-1.5 text-xs ${complete ? "text-success" : "text-muted-foreground"}`}>{complete ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}{step.label}</span>;
            })}
          </div>
        </div>
        {next && <Button asChild><Link to={next.to}>Continue setup <ChevronRight /></Link></Button>}
      </div>
    </section>
  );
}