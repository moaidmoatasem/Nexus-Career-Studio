import { VaultItem, JobPosting, ApplicationRecord } from '../types/career';

export interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  targetRole: string;
  yearsOfExp: number;
  targetDomains: string[];
  requiresSponsorship: boolean;
  targetCountry: string;
  preferredLanguage: 'en' | 'ar';
  skills: string[];
}

export const INITIAL_PROFILE: CandidateProfile = {
  fullName: 'Moaid El Sayed',
  email: 'moaid.elmoatasem.bellah@gmail.com',
  phone: '+44 7700 900123',
  targetRole: 'Staff / Senior Software Engineer',
  yearsOfExp: 6,
  targetDomains: ['Distributed Systems', 'Cloud & DevOps', 'FinTech', 'Embedded & Automotive'],
  requiresSponsorship: true,
  targetCountry: 'UK',
  preferredLanguage: 'en',
  skills: [
    'TypeScript', 'Go', 'Python', 'C++', 'Kubernetes', 'Docker', 
    'PostgreSQL', 'Redis', 'Kafka', 'AWS', 'GCP', 'Linux', 'Microservices', 'RESTful APIs'
  ],
};

export const INITIAL_VAULT_ITEMS: VaultItem[] = [
  {
    id: 'vault_apex_01',
    category: 'experience',
    title: 'Senior Software Engineer',
    organization: 'Apex FinTech Solutions',
    startDate: '2022-03',
    endDate: 'Present',
    isCurrent: true,
    description: 'Led architecture of high-throughput payment transaction pipelines handling multi-currency settlements.',
    metrics: [
      'Reduced API p99 latency by 42%',
      'Scaled throughput to process $14M daily transactions',
      'Architected 12 microservices with zero downtime'
    ],
    skills: ['Go', 'TypeScript', 'Kubernetes', 'PostgreSQL', 'Kafka', 'Redis'],
    isVerified: true,
  },
  {
    id: 'vault_global_02',
    category: 'achievement',
    title: 'Cloud Migration & Kubernetes Modernization',
    organization: 'Global Systems Corp',
    startDate: '2020-06',
    endDate: '2022-02',
    isCurrent: false,
    description: 'Spearheaded legacy monolith containerization and multi-cluster Kubernetes deployment on AWS and GCP.',
    metrics: [
      'Cut annual cloud infrastructure spend by 28%',
      'Accelerated deployment frequency from bi-weekly to 6 times daily',
      'Achieved 99.99% service availability SLA'
    ],
    skills: ['AWS', 'GCP', 'Kubernetes', 'Terraform', 'Docker', 'CI/CD'],
    isVerified: true,
  },
  {
    id: 'vault_automotive_03',
    category: 'project',
    title: 'Embedded Linux & Edge Telemetry Gateway',
    organization: 'Nexus Edge Lab',
    startDate: '2019-01',
    endDate: '2020-05',
    isCurrent: false,
    description: 'Engineered memory-safe C++ and Yocto Linux middleware for low-latency vehicle-to-cloud diagnostic telemetry.',
    metrics: [
      'Lowered CAN bus payload serialization overhead by 35%',
      'Deployed firmware safely to 50,000+ edge embedded units'
    ],
    skills: ['C++', 'Linux', 'Yocto', 'RTOS', 'gRPC'],
    isVerified: true,
  },
  {
    id: 'vault_education_04',
    category: 'education',
    title: 'B.Sc. in Computer Engineering',
    organization: 'Faculty of Engineering',
    startDate: '2014-09',
    endDate: '2019-06',
    isCurrent: false,
    description: 'Graduated with First Class Honours. Specialized in Distributed Operating Systems and High-Performance Computing.',
    metrics: ['Graduated in Top 5% of class', 'Authored thesis on distributed consensus'],
    skills: ['Algorithms', 'Data Structures', 'Distributed Systems'],
    isVerified: true,
  }
];

export const INITIAL_JOB_POSTINGS: JobPosting[] = [
  {
    id: 'job_arm_01',
    title: 'Senior Systems & Cloud Infrastructure Engineer',
    companyName: 'Arm Limited',
    companyNormalized: 'arm',
    location: 'Cambridge / London (Hybrid)',
    country: 'UK',
    isRemote: false,
    salaryRange: '£90,000 - £115,000',
    jobUrl: 'https://careers.arm.com/job/senior-systems-engineer',
    description: 'Arm is seeking a Senior Engineer to scale our distributed build and cloud verification infrastructure across hybrid bare-metal and AWS Kubernetes clusters.',
    requiredSkills: ['Go', 'Kubernetes', 'Linux', 'Docker', 'AWS'],
    preferredSkills: ['C++', 'Python', 'Terraform'],
    minYearsExp: 5,
    domain: 'Cloud & DevOps',
    sponsorVerified: true,
    sponsorLicenseType: 'Worker (A rating)',
    sponsorRoute: 'Skilled Worker',
    discoveredAt: '2026-10-05T07:15:00Z',
    source: 'greenhouse',
  },
  {
    id: 'job_revolut_02',
    title: 'Staff Backend Engineer - Core Payments',
    companyName: 'Revolut Ltd',
    companyNormalized: 'revolut',
    location: 'London, UK (Remote Eligible)',
    country: 'UK',
    isRemote: true,
    salaryRange: '£110,000 - £140,000 + Equity',
    jobUrl: 'https://www.revolut.com/careers/staff-backend-engineer',
    description: 'Join our Core Payments tribe to architect high-throughput, fault-tolerant microservices processing global multi-currency settlements with sub-second finality.',
    requiredSkills: ['Go', 'PostgreSQL', 'Kafka', 'Microservices', 'Distributed Systems'],
    preferredSkills: ['TypeScript', 'Redis', 'Kubernetes'],
    minYearsExp: 6,
    domain: 'FinTech',
    sponsorVerified: true,
    sponsorLicenseType: 'Worker (A rating)',
    sponsorRoute: 'Skilled Worker',
    discoveredAt: '2026-10-05T06:30:00Z',
    source: 'lever',
  },
  {
    id: 'job_deepmind_03',
    title: 'Research Platform & Cloud Infrastructure Engineer',
    companyName: 'DeepMind Technologies Limited',
    companyNormalized: 'deepmind technologies',
    location: 'London (King\'s Cross)',
    country: 'UK',
    isRemote: false,
    salaryRange: '£120,000 - £160,000 + Bonus',
    jobUrl: 'https://deepmind.google/careers/platform-engineer',
    description: 'Build robust compute platforms, distributed storage orchestration, and AI model serving pipelines powering flagship research breakthroughs on Google Cloud Platform.',
    requiredSkills: ['Python', 'Kubernetes', 'GCP', 'Distributed Systems', 'Linux'],
    preferredSkills: ['C++', 'Go', 'PyTorch', 'Vector Search (pgvector)'],
    minYearsExp: 5,
    domain: 'AI & Data Engineering',
    sponsorVerified: true,
    sponsorLicenseType: 'Worker (A rating)',
    sponsorRoute: 'Skilled Worker',
    discoveredAt: '2026-10-05T08:00:00Z',
    source: 'ashby',
  },
  {
    id: 'job_monzo_04',
    title: 'Senior Distributed Systems Engineer',
    companyName: 'Monzo Bank Limited',
    companyNormalized: 'monzo bank',
    location: 'London / Remote UK',
    country: 'UK',
    isRemote: true,
    salaryRange: '£95,000 - £125,000',
    jobUrl: 'https://monzo.com/careers/senior-systems-engineer',
    description: 'We run over 2,500 microservices on AWS Kubernetes. You will engineer core platform tooling, observability, and RPC reliability mechanisms for millions of UK bank accounts.',
    requiredSkills: ['Go', 'Kubernetes', 'AWS', 'Microservices'],
    preferredSkills: ['TypeScript', 'PostgreSQL', 'Docker'],
    minYearsExp: 4,
    domain: 'FinTech',
    sponsorVerified: true,
    sponsorLicenseType: 'Worker (A rating)',
    sponsorRoute: 'Skilled Worker',
    discoveredAt: '2026-10-05T05:45:00Z',
    source: 'direct',
  },
  {
    id: 'job_generic_05',
    title: 'Full Stack Engineer (No Visa Sponsorship)',
    companyName: 'Local Retail Boutique UK Ltd',
    companyNormalized: 'local retail boutique',
    location: 'Manchester, UK',
    country: 'UK',
    isRemote: false,
    salaryRange: '£55,000 - £65,000',
    jobUrl: 'https://example.com/jobs/fullstack-boutique',
    description: 'Looking for a generalist Web developer to manage our Shopify and internal inventory portal. Candidates must have pre-existing UK Right to Work (no visa sponsorship provided).',
    requiredSkills: ['JavaScript', 'HTML/CSS', 'PHP'],
    preferredSkills: ['React', 'MySQL'],
    minYearsExp: 2,
    domain: 'E-commerce',
    sponsorVerified: false,
    discoveredAt: '2026-10-05T04:20:00Z',
    source: 'direct',
  }
];

export const INITIAL_APPLICATIONS: ApplicationRecord[] = [
  {
    id: 'app_revolut_01',
    jobId: 'job_revolut_02',
    companyName: 'Revolut Ltd',
    roleTitle: 'Staff Backend Engineer - Core Payments',
    status: 'interviewing',
    fitScore: 94,
    appliedAt: '2026-10-02T10:30:00Z',
    notes: 'Technical screen completed with Lead Architect. System design round scheduled next.',
    interviewUrl: 'https://calendly.com/revolut-engineering/system-design-sync',
    nextAction: 'Prepare high-throughput payment settlement distributed consensus walkthrough.',
    lastEmailStatus: 'interview_invite',
    tailoredPack: {
      jobId: 'job_revolut_02',
      companyName: 'Revolut Ltd',
      roleTitle: 'Staff Backend Engineer - Core Payments',
      fitScore: 94,
      scoreBreakdown: {
        totalScore: 94,
        skillScore: 95,
        seniorityScore: 100,
        domainScore: 100,
        visaSatisfied: true,
        matchedSkills: ['Go', 'PostgreSQL', 'Kafka', 'Microservices', 'Distributed Systems'],
        missingSkills: [],
      },
      bullets: [
        {
          vault_item_id: 'vault_apex_01',
          tailored_text: 'Architected distributed Go microservices handling multi-currency clearing, slashing API p99 latency by 42% across transaction endpoints.',
          verified_metrics: ['Reduced API p99 latency by 42%'],
          aligned_skills: ['Go', 'Microservices', 'Distributed Systems'],
          isProven: true,
        },
        {
          vault_item_id: 'vault_apex_01',
          tailored_text: 'Engineered high-concurrency event-driven Kafka pipelines scaling daily settlement volume to $14M with zero data loss.',
          verified_metrics: ['Scaled throughput to process $14M daily transactions'],
          aligned_skills: ['Kafka', 'PostgreSQL', 'Go'],
          isProven: true,
        },
      ],
      coverLetter: 'Dear Revolut Hiring Team,\n\nI am thrilled to apply for the Staff Backend Engineer role on Core Payments. Having architected event-driven Go microservices scaling daily settlement volume to $14M and reduced p99 latency by 42% at Apex FinTech, I am uniquely poised to accelerate Revolut’s transaction reliability.\n\nSincerely,\nMoaid El Sayed',
      recruiterOutreach: 'Hi Sarah, I noticed the Staff Backend opening on Revolut’s Core Payments team. Having architected distributed Go microservices processing $14M daily volume with 42% p99 latency reductions, I’d love to connect!',
      generatedAt: '2026-10-02T09:15:00Z',
      provenanceValid: true,
    }
  },
  {
    id: 'app_arm_02',
    jobId: 'job_arm_01',
    companyName: 'Arm Limited',
    roleTitle: 'Senior Systems & Cloud Infrastructure Engineer',
    status: 'tailored',
    fitScore: 92,
    notes: 'Tailored pack approved and staged. Ready for 1-click assisted dispatch.',
    nextAction: 'Launch Arm portal with staged credentials and ATS single-column resume.',
    tailoredPack: {
      jobId: 'job_arm_01',
      companyName: 'Arm Limited',
      roleTitle: 'Senior Systems & Cloud Infrastructure Engineer',
      fitScore: 92,
      scoreBreakdown: {
        totalScore: 92,
        skillScore: 90,
        seniorityScore: 100,
        domainScore: 100,
        visaSatisfied: true,
        matchedSkills: ['Go', 'Kubernetes', 'Linux', 'Docker', 'AWS'],
        missingSkills: [],
      },
      bullets: [
        {
          vault_item_id: 'vault_global_02',
          tailored_text: 'Spearheaded enterprise Kubernetes cluster modernization on AWS and GCP, reducing annual cloud infrastructure spend by 28%.',
          verified_metrics: ['Cut annual cloud infrastructure spend by 28%'],
          aligned_skills: ['Kubernetes', 'AWS', 'GCP', 'Terraform'],
          isProven: true,
        },
        {
          vault_item_id: 'vault_automotive_03',
          tailored_text: 'Engineered embedded Linux and C++ middleware optimizing edge diagnostics, successfully trimming CAN serialization overhead by 35%.',
          verified_metrics: ['Lowered CAN bus payload serialization overhead by 35%'],
          aligned_skills: ['Linux', 'C++'],
          isProven: true,
        }
      ],
      coverLetter: 'Dear Arm Engineering Team,\n\nI am excited to apply for the Senior Systems & Cloud Infrastructure Engineer position. Having managed multi-region Kubernetes clusters cutting cloud spend by 28% while architecting low-level Linux systems, I welcome the opportunity to support Arm’s next-generation compute platform.\n\nSincerely,\nMoaid El Sayed',
      recruiterOutreach: 'Hi Alex, thrilled to see Arm’s Senior Systems & Cloud opening. Having led Kubernetes cluster modernizations cutting cloud spend by 28% alongside embedded Linux development, I’d welcome a brief chat.',
      generatedAt: '2026-10-05T07:30:00Z',
      provenanceValid: true,
    }
  },
  {
    id: 'app_deepmind_03',
    jobId: 'job_deepmind_03',
    companyName: 'DeepMind Technologies Limited',
    roleTitle: 'Research Platform & Cloud Infrastructure Engineer',
    status: 'queued',
    fitScore: 88,
    notes: 'Discovered via Ashby radar. Licensed UK A-rating sponsor verified.',
    nextAction: 'Review and approve tailored pack in daily queue.',
  }
];

export const SAMPLE_EMAILS = [
  {
    id: 'email_invite_01',
    sender: 'recruitment@revolut.com',
    subject: 'Next Steps: System Design Interview with Revolut',
    body: `Hi Moaid,

Thank you for your time during our technical screen. Our team was very impressed with your background in distributed Go microservices and latency optimization.

We would love to invite you to our next round: a 60-minute System Design Interview. Please use the following link to select a time that fits your calendar:
https://calendly.com/revolut-engineering/system-design-sync

Please prepare to discuss distributed transaction consistency and high-throughput event processing.

Best regards,
The Revolut Talent Acquisition Team`,
  },
  {
    id: 'email_ack_02',
    sender: 'no-reply@greenhouse.io',
    subject: 'Application Received: Senior Cloud Infrastructure Engineer at Arm',
    body: `Dear Moaid,

Thank you for applying to the Senior Systems & Cloud Infrastructure Engineer position at Arm Limited. 

We have received your application materials, including your tailored CV and cover letter. Our recruiting team is reviewing your profile and will be in touch shortly regarding next steps.

You can view your application status at any time in the Arm Candidate Portal.

Kind regards,
Arm Talent Team`,
  },
  {
    id: 'email_reject_03',
    sender: 'talent@lever.co',
    subject: 'Update on your application with CloudScale Labs',
    body: `Hi Moaid,

Thank you for taking the time to speak with our engineering manager. 

Unfortunately, after careful consideration, we have decided to pursue other candidates whose experience aligns more closely with our specific legacy infrastructure needs at this time.

We will keep your profile in our candidate pool for future opportunities that match your verified skill set.

We wish you the very best in your search.

Sincerely,
CloudScale Labs Recruiting`,
  }
];
