import { GoogleGenAI } from '@google/genai';
import { VaultItem, TailoredBullet, EmailClassificationResult } from '../types/career';
import { validateBulletProvenance } from './provenanceValidator';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Prompt 1: Master Career Vault Extractor
 * Extracts work experience, achievements, and exact verified metrics from raw text.
 */
export async function extractVaultItemsFromText(rawText: string): Promise<VaultItem[]> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const prompt = `Extract all work experiences, achievements, education, and distinct projects from the candidate's resume/profile text below.
CRITICAL INVARIANTS:
1. For every achievement, extract exact quantifiable metrics (percentages, numbers, dollar amounts, scale) into the "metrics" array.
2. Do not invent or extrapolate numbers. Only extract numbers explicitly stated in the text.
3. List skills demonstrated in that item.
4. Return an array of structured items.

Candidate Profile Text:
${rawText}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction: 'You are an enterprise resume parser and Master Career Vault extractor. You convert raw text into high-fidelity structured items with verifiable metrics.',
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const text = response.text || '[]';
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.experiences || []);

  return items.map((item: any, idx: number) => ({
    id: item.id || `vault_item_${Date.now()}_${idx}`,
    category: item.category || 'experience',
    title: item.title || 'Professional Experience',
    organization: item.organization || item.company || 'Enterprise',
    startDate: item.startDate || item.start_date || '2023',
    endDate: item.endDate || item.end_date || 'Present',
    isCurrent: Boolean(item.isCurrent || (item.endDate && item.endDate.toLowerCase().includes('present'))),
    description: item.description || '',
    metrics: Array.isArray(item.metrics) ? item.metrics : [],
    skills: Array.isArray(item.skills) ? item.skills : [],
    isVerified: true,
  }));
}

/**
 * Prompt 2: Deterministic Reference-Bound Tailoring
 * Generates resume bullets, strictly bound to a vault_item_id, plus cover letter and recruiter DM.
 */
export async function generateTailoredPackWithGemini(
  job: {
    title: string;
    company: string;
    description: string;
    requiredSkills: string[];
    domain: string;
  },
  vaultItems: VaultItem[]
): Promise<{
  bullets: TailoredBullet[];
  coverLetter: string;
  recruiterOutreach: string;
  provenanceValid: boolean;
  provenanceViolations: string[];
}> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const vaultContext = vaultItems.map(item => ({
    vault_item_id: item.id,
    title: item.title,
    organization: item.organization,
    verified_metrics: item.metrics,
    skills: item.skills,
    description: item.description,
  }));

  const prompt = `You are an expert ATS resume optimizer and career strategist.
Target Job:
Role: ${job.title}
Company: ${job.company}
Domain: ${job.domain}
Required Skills: ${job.requiredSkills.join(', ')}
Job Description:
${job.description}

Candidate's Verified Vault Items (with explicit vault_item_id):
${JSON.stringify(vaultContext, null, 2)}

TASK:
1. Produce 3 to 5 tailored resume bullets that highlight candidate fit for this role.
2. CRITICAL ZERO-HALLUCINATION INVARIANT:
   - For every single bullet, you MUST specify the exact "vault_item_id" from the candidate's vault that grounds the claim.
   - You may polish and align phrasing with the job description, but DO NOT invent any metrics, statistics, frameworks, or dates that are not in the referenced vault item.
   - Any metric in "verified_metrics" MUST exist verbatim in the source vault item.
3. Craft a personalized, 3-paragraph tailored cover letter referencing only verified facts.
4. Craft a concise, high-conversion warm recruiter outreach message (max 75 words).

Return a single JSON object with this exact structure:
{
  "bullets": [
    {
      "vault_item_id": "string",
      "tailored_text": "string",
      "verified_metrics": ["string"],
      "aligned_skills": ["string"]
    }
  ],
  "coverLetter": "string",
  "recruiterOutreach": "string"
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction: 'You are an ATS resume optimizer enforcing reference binding. You are strictly forbidden from inventing metrics or citing phantom vault IDs.',
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  const bullets: TailoredBullet[] = Array.isArray(parsed.bullets) ? parsed.bullets : [];

  // Deterministic Server-side In-flight Provenance Audit
  const audit = validateBulletProvenance(bullets, vaultItems);

  return {
    bullets: bullets.map((b, i) => ({
      ...b,
      isProven: !audit.violations.some(v => v.bulletIndex === i),
    })),
    coverLetter: parsed.coverLetter || 'Dear Hiring Team,\n\nI am thrilled to apply for this role...',
    recruiterOutreach: parsed.recruiterOutreach || `Hi team, I noticed the ${job.title} opening at ${job.company}...`,
    provenanceValid: audit.isValid,
    provenanceViolations: audit.violations.map(v => `[Bullet ${v.bulletIndex + 1} (${v.reason})]: ${v.detail}`),
  };
}

/**
 * Prompt 3: Enterprise ATS Email Status Classifier
 * Classifies recruitment emails into lifecycle stages.
 */
export async function classifyEmailWithGemini(
  emailPayload: {
    sender: string;
    subject: string;
    body: string;
  }
): Promise<EmailClassificationResult> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const prompt = `Classify this recruitment email into one of these exact lifecycle statuses:
- "applied_ack" (Application received/confirmation)
- "screening" (Take-home test, online assessment, recruiter sync request)
- "interview_invite" (Explicit interview invitation, scheduling request, technical screen)
- "offer" (Offer extended, compensation package)
- "rejection" (Unfortunately decided to move forward with other candidates)
- "action_required" (Missing documents, candidate portal login required)
- "informational" (Newsletter, job alert, or generic marketing)

Also extract:
- company_name
- confidence (0.0 to 1.0)
- scheduling_url (if Calendly, GoodTime, Chili Piper, or custom calendar link is present)
- action_summary (one concise action sentence for the candidate)

Email:
From: ${emailPayload.sender}
Subject: ${emailPayload.subject}
Body:
${emailPayload.body.slice(0, 3000)}

Return JSON:
{
  "status": "applied_ack" | "screening" | "interview_invite" | "offer" | "rejection" | "action_required" | "informational",
  "company_name": "string",
  "confidence": number,
  "scheduling_url": "string or null",
  "action_summary": "string"
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction: 'You are an enterprise recruitment email triage classifier for Workday, Greenhouse, Lever, Ashby, and Taleo communications.',
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return {
    status: parsed.status || 'applied_ack',
    companyName: parsed.company_name || 'Employer',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
    schedulingUrl: parsed.scheduling_url || undefined,
    actionSummary: parsed.action_summary || 'Application update received',
    sender: emailPayload.sender,
    subject: emailPayload.subject,
  };
}
