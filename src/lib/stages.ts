// Application stage rules shared by Gmail sync, manual email triage and insights.
// Pure and deterministic so the same rules apply on the server and in tests.

export const PIPELINE = [
  "queued",
  "tailored",
  "applied",
  "screening",
  "interviewing",
  "offered",
] as const;
export type PipelineStage = (typeof PIPELINE)[number];
export type Stage = PipelineStage | "rejected";

const EMAIL_TO_STAGE: Record<string, Stage | null> = {
  applied_ack: "applied",
  screening: "screening",
  interview_invite: "interviewing",
  offer: "offered",
  rejection: "rejected",
  action_required: null,
  informational: null,
};

/** The stage a classified recruitment email points to, or null for informational mail. */
export function stageForEmail(status: string): Stage | null {
  return EMAIL_TO_STAGE[status] ?? null;
}

/**
 * The stage an email may move an application to, or null to leave the card where it is.
 * Email never moves a card backwards (a late "we received your application" must not undo
 * an interview), never reopens a closed application, and never turns an offer into a
 * rejection — those cases stay with the candidate.
 */
export function nextStageFromEmail(current: string, proposed: Stage | null): Stage | null {
  if (!proposed || proposed === current) return null;
  if (current === "rejected") return null;
  if (proposed === "rejected") return current === "offered" ? null : "rejected";
  const from = PIPELINE.indexOf(current as PipelineStage);
  const to = PIPELINE.indexOf(proposed as PipelineStage);
  return to > from ? proposed : null;
}

/** True when a stage means the candidate has already submitted the application. */
export function isSubmittedStage(stage: string): boolean {
  return (
    stage === "rejected" || PIPELINE.indexOf(stage as PipelineStage) >= PIPELINE.indexOf("applied")
  );
}
