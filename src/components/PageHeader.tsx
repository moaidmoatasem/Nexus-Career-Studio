import type { ReactNode } from "react";

export function PageHeader({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5 border-b pb-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  return (
    <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-current bg-background font-display text-xl font-semibold ${color}`}>
      <span>{score}<span className="block text-center font-sans text-[9px] font-medium text-muted-foreground">FIT</span></span>
    </div>
  );
}
