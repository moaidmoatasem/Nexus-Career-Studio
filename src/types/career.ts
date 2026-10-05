export type VaultCategory = 'experience' | 'achievement' | 'skill' | 'education' | 'project' | 'certification';

export interface VaultItem {
  id: string;
  category: VaultCategory;
  title: string;
  organization: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  metrics: string[]; // e.g. ["Reduced API latency by 42%", "Managed 14 microservices"]
  skills: string[];
  isVerified: boolean;
  createdAt?: string;
}

export interface JobPosting {
  id: string;
  title: string;
  companyName: string;
  companyNormalized: string;
  location: string;
  country: string;
  isRemote: boolean;
  salaryRange?: string;
  jobUrl: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minYearsExp: number;
  domain: string;
  sponsorVerified: boolean;
  sponsorLicenseType?: string;
  sponsorRoute?: string;
  discoveredAt: string;
  source: 'greenhouse' | 'lever' | 'ashby' | 'direct';
}

export interface ScoreBreakdown {
  totalScore: number;
  skillScore: number;
  seniorityScore: number;
  domainScore: number;
  visaSatisfied: boolean;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface TailoredBullet {
  vault_item_id: string;
  tailored_text: string;
  verified_metrics: string[];
  aligned_skills: string[];
  isProven?: boolean;
}

export interface TailoredPack {
  jobId: string;
  companyName: string;
  roleTitle: string;
  fitScore: number;
  scoreBreakdown: ScoreBreakdown;
  bullets: TailoredBullet[];
  coverLetter: string;
  recruiterOutreach: string;
  generatedAt: string;
  provenanceValid: boolean;
  provenanceViolations?: string[];
}

export type ApplicationStatus = 'queued' | 'tailored' | 'applied' | 'screening' | 'interviewing' | 'offered' | 'rejected';

export interface ApplicationRecord {
  id: string;
  jobId: string;
  companyName: string;
  roleTitle: string;
  status: ApplicationStatus;
  fitScore: number;
  appliedAt?: string;
  notes?: string;
  tailoredPack?: TailoredPack;
  lastEmailStatus?: string;
  interviewUrl?: string;
  nextAction?: string;
}

export interface SponsorRecord {
  id: number;
  organisationName: string;
  organisationNormalized: string;
  townCity: string;
  county: string;
  typeRating: string;
  route: string;
  similarity?: number;
}

export type EmailLifecycleStatus = 
  | 'applied_ack' 
  | 'screening' 
  | 'interview_invite' 
  | 'offer' 
  | 'rejection' 
  | 'action_required' 
  | 'informational';

export interface EmailClassificationResult {
  status: EmailLifecycleStatus;
  companyName: string;
  confidence: number;
  schedulingUrl?: string;
  actionSummary: string;
  extractedDate?: string;
  sender: string;
  subject: string;
}
