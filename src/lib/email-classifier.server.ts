import { z } from "zod/v4";
import { generateStructured } from "./ai.server";

export const emailSchema = z.object({
  status: z.enum([
    "applied_ack",
    "screening",
    "interview_invite",
    "offer",
    "rejection",
    "action_required",
    "informational",
  ]),
  company_name: z.string(),
  confidence: z.number(),
  scheduling_url: z.string().nullable(),
  action_summary: z.string(),
});

export type EmailClassification = z.infer<typeof emailSchema>;

export async function classifyRecruitmentEmail(input: {
  sender: string;
  subject: string;
  body: string;
}) {
  return generateStructured({
    instructions:
      "You are a recruitment email triage classifier for Workday, Greenhouse, Lever, Ashby and Taleo emails. Pick exactly one status. confidence is 0–1. Extract a scheduling link only if present verbatim.",
    prompt: `From: ${input.sender}\nSubject: ${input.subject}\n\n${input.body}`,
    schema: emailSchema,
  });
}
