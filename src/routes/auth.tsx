import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nexus Career Studio" },
      { name: "description", content: "Sign in to your Nexus Career Studio workspace." },
      { property: "og:title", content: "Sign in — Nexus Career Studio" },
      { property: "og:description", content: "Access your career vault and applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/radar" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/radar" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin + "/radar" },
          });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "up" && !res.data.session)
      toast.success("Check your email to confirm your account.");
  }

  // Google sign-in through Supabase Auth (enable the Google provider in your Supabase project).
  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[.9fr_1.1fr]">
      <aside className="hidden flex-col justify-between border-r bg-sidebar p-12 lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span>
            <strong className="block font-display text-sm">Nexus</strong>
            <span className="block text-[10px] text-muted-foreground">CAREER STUDIO</span>
          </span>
        </Link>
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase text-primary">
            A better application starts with proof
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight">
            Your experience remains the source of truth.
          </h2>
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            {[
              "Your metrics stay verbatim",
              "Every number in your materials is fact-checked",
              "Fit scores use transparent rules",
            ].map((item) => (
              <p key={item} className="flex items-center gap-3">
                <Check className="size-4 text-success" />
                {item}
              </p>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for focused, evidence-led job searches.
        </p>
      </aside>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <p className="text-xs font-semibold uppercase text-primary">Secure workspace</p>
          <h1 className="mt-3 font-display text-3xl font-semibold">
            {mode === "in" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "in"
              ? "Continue where you left off."
              : "Start building your verified career record."}
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={google}>
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or with email
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
