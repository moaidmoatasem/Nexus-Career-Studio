import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { calculateFitScore, type ScoreBreakdown } from "./scoring";
import type { ProvenanceViolation, TailoredBullet } from "./provenance";

export type Job = Tables<"jobs">;
export type VaultItem = Tables<"vault_items">;
export type Profile = Tables<"profiles">;
export type Application = Tables<"applications"> & { jobs: Job | null };
export type RoleDecision = Tables<"role_decisions">;
export type SourceConnection = Tables<"source_connections">;
export type ApplicationEvent = Tables<"application_events">;
export type UnmatchedMail = Tables<"unmatched_mail_messages">;
export interface TailoredPack {
  bullets: TailoredBullet[];
  rejected: ProvenanceViolation[];
  coverLetter: string;
  recruiterOutreach: string;
  scoreBreakdown: ScoreBreakdown;
  provenanceValid: boolean;
  generatedAt: string;
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const id = await uid();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: e2 } = await supabase.from("profiles").insert({ id }).select("*").single();
      if (e2) throw e2;
      return created;
    },
  });
}

export function useVault() {
  return useQuery({
    queryKey: ["vault"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("discovered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSponsorSet(companies: string[]) {
  return useQuery({
    queryKey: ["sponsor-set", companies],
    enabled: companies.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        companies.map(async (c) => {
          const { data } = await supabase.rpc("match_sponsor_company_v3", { search_term: c });
          return [c, data?.[0] ?? null] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    staleTime: 5 * 60_000,
  });
}

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*, jobs(*)").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Application[];
    },
  });
}

export function useRoleDecisions() {
  return useQuery({
    queryKey: ["role-decisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_decisions").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSourceConnections() {
  return useQuery({
    queryKey: ["source-connections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("source_connections").select("*").order("source");
      if (error) throw error;
      return data;
    },
  });
}

export function useApplicationEvents() {
  return useQuery({
    queryKey: ["application-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("application_events").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
}

export function useUnmatchedMail() {
  return useQuery({
    queryKey: ["unmatched-mail"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unmatched_mail_messages").select("*").eq("review_status", "pending").order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function scoreJob(job: Job, vault: VaultItem[], profile: Profile | undefined, sponsored: boolean) {
  return calculateFitScore(
    {
      skills: vault.flatMap((v) => v.skills),
      years: profile?.years_experience ?? 0,
      domains: profile?.target_domains ?? [],
      requiresVisa: profile?.requires_visa ?? false,
    },
    { requiredSkills: job.required_skills, preferredSkills: job.preferred_skills, minYearsExp: job.min_years_exp, domain: job.domain, sponsorVerified: sponsored },
  );
}

export { uid };
