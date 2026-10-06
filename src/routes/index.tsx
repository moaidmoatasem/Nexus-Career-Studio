import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, FileCheck2, Landmark, Radar, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus Career Studio — Evidence-led job applications" },
      {
        name: "description",
        content: "Move from verified career evidence to stronger UK job applications.",
      },
      { property: "og:title", content: "Nexus Career Studio — Evidence-led job applications" },
      {
        property: "og:description",
        content: "Score roles, verify sponsors, and tailor every claim from your real experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    icon: FileCheck2,
    n: "01",
    title: "Build your evidence",
    copy: "Turn your real experience into a verified career record.",
  },
  {
    icon: Radar,
    n: "02",
    title: "Choose the right role",
    copy: "Compare fit, skill gaps, and sponsorship before investing time.",
  },
  {
    icon: ShieldCheck,
    n: "03",
    title: "Apply with confidence",
    copy: "Create tailored materials where every claim stays grounded.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span>
            <strong className="block font-display text-sm">Nexus</strong>
            <span className="block text-[10px] text-muted-foreground">CAREER STUDIO</span>
          </span>
        </Link>
        <Button asChild variant="outline">
          <Link to="/auth">
            Sign in <ArrowRight />
          </Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-12 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-20 lg:pt-24">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Evidence-led career decisions
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-7xl">
            Make every application <span className="text-primary">defensible.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Score opportunities honestly, confirm UK sponsorship, and tailor each application from
            achievements you can prove.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/radar">
                Enter your workspace <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/auth">Create an account</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["Grounded claims only", "Deterministic fit scores", "UK sponsor checks"].map(
              (item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check className="size-3 text-success" />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="relative self-center border-l border-border pl-7 lg:pl-10">
          <p className="mb-5 text-xs font-semibold uppercase text-muted-foreground">
            Your application path
          </p>
          <div className="space-y-3">
            {STEPS.map((step, index) => (
              <div
                key={step.n}
                className="group flex gap-4 rounded-md border bg-card p-5 surface-lift transition-transform hover:-translate-y-0.5"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-md ${index === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  <step.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display font-semibold">{step.title}</h2>
                    <span className="font-mono text-[10px] text-muted-foreground">{step.n}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm">
            <Landmark className="size-4 text-success" />
            <span>Visa sponsor status stays visible at every decision.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
