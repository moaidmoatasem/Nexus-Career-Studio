import React, { useState } from 'react';
import { JobPosting, ScoreBreakdown, ApplicationRecord, VaultItem } from '../types/career';
import { CandidateProfile } from '../data/initialData';
import { calculateFitScore } from '../server/scoringEngine';
import { matchSponsorCompanyV3 } from '../server/sponsorMatcher';
import { SPONSOR_REGISTRY } from '../data/mockSponsors';
import { 
  Compass, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  Briefcase, 
  MapPin, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Filter,
  PlusCircle,
  Building2,
  DollarSign
} from 'lucide-react';

interface RoleRadarViewProps {
  jobs: JobPosting[];
  setJobs: React.Dispatch<React.SetStateAction<JobPosting[]>>;
  profile: CandidateProfile;
  vaultItems: VaultItem[];
  applications: ApplicationRecord[];
  setApplications: React.Dispatch<React.SetStateAction<ApplicationRecord[]>>;
  requiresSponsorship: boolean;
  onNavigateToSynthesizer: (job: JobPosting) => void;
  lang: 'en' | 'ar';
}

export const RoleRadarView: React.FC<RoleRadarViewProps> = ({
  jobs,
  setJobs,
  profile,
  vaultItems,
  applications,
  setApplications,
  requiresSponsorship,
  onNavigateToSynthesizer,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [minScoreFilter, setMinScoreFilter] = useState<number>(75);
  const [showOnlySponsors, setShowOnlySponsors] = useState(requiresSponsorship);
  const [isPasteJobOpen, setIsPasteJobOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteCompany, setPasteCompany] = useState('');
  const [pasteSkills, setPasteSkills] = useState('');
  const [pasteDesc, setPasteDesc] = useState('');

  // Extract all candidate skills from vault + profile
  const allCandidateSkills = Array.from(
    new Set([...profile.skills, ...vaultItems.flatMap(v => v.skills)])
  );

  // Compute live scores for all jobs
  const scoredJobs = jobs.map(job => {
    // Cross-check with UK Sponsor Registry
    const sponsorMatches = matchSponsorCompanyV3(job.companyName, SPONSOR_REGISTRY);
    const isSponsor = sponsorMatches.length > 0;
    const license = sponsorMatches[0]?.typeRating;
    const route = sponsorMatches[0]?.route;

    const breakdown = calculateFitScore(
      allCandidateSkills,
      profile.yearsOfExp,
      profile.targetDomains,
      showOnlySponsors || requiresSponsorship,
      {
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        minYearsExp: job.minYearsExp,
        domain: job.domain,
        sponsorVerified: isSponsor,
      }
    );

    return {
      ...job,
      sponsorVerified: isSponsor,
      sponsorLicenseType: license,
      sponsorRoute: route,
      score: breakdown,
    };
  });

  const filteredJobs = scoredJobs
    .filter(j => j.score.totalScore >= minScoreFilter)
    .filter(j => !showOnlySponsors || j.sponsorVerified)
    .sort((a, b) => b.score.totalScore - a.score.totalScore);

  const handlePasteJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteTitle.trim() || !pasteCompany.trim()) return;

    const parsedSkills = pasteSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const sponsorMatches = matchSponsorCompanyV3(pasteCompany, SPONSOR_REGISTRY);
    const isSponsor = sponsorMatches.length > 0;

    const newJob: JobPosting = {
      id: `job_custom_${Date.now()}`,
      title: pasteTitle,
      companyName: pasteCompany,
      companyNormalized: pasteCompany.toLowerCase().trim(),
      location: 'London, UK / Remote',
      country: 'UK',
      isRemote: true,
      salaryRange: 'Market Competitive',
      jobUrl: 'https://boards.greenhouse.io',
      description: pasteDesc || `High-growth role for ${pasteTitle} at ${pasteCompany}.`,
      requiredSkills: parsedSkills.slice(0, 4),
      preferredSkills: parsedSkills.slice(4),
      minYearsExp: 4,
      domain: 'Cloud & Distributed Systems',
      sponsorVerified: isSponsor,
      sponsorLicenseType: sponsorMatches[0]?.typeRating,
      sponsorRoute: sponsorMatches[0]?.route,
      discoveredAt: new Date().toISOString(),
      source: 'direct',
    };

    setJobs(prev => [newJob, ...prev]);
    setIsPasteJobOpen(false);
    setPasteTitle('');
    setPasteCompany('');
    setPasteSkills('');
    setPasteDesc('');
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-950/80 border-emerald-600/60';
    if (score >= 70) return 'text-amber-400 bg-amber-950/80 border-amber-600/60';
    return 'text-rose-400 bg-rose-950/80 border-rose-600/60';
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Compass className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                {isAr ? 'رادار الوظائف والمطابقة الذاتية' : 'Autonomous Role Radar'}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              {isAr
                ? 'يفحص خلاصات التوظيف (Greenhouse, Lever, Ashby) على مدار الساعة، ويطابق المهارات الحسابية بدقة متناهية مع التحقق الفوري من سجل الكفالة البريطانية.'
                : 'Continuously aggregates opportunities matching candidate seniority and stack, applying deterministic integer scoring (+/-1pt parity) and instant UK sponsor verification.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPasteJobOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isAr ? 'لصق إعلان وظيفة فوري' : 'Paste Live Job URL'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">
                {isAr ? 'الحد الأدنى للتوافق:' : 'Min Match Threshold:'}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {minScoreFilter}%
              </span>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={minScoreFilter}
                onChange={e => setMinScoreFilter(Number(e.target.value))}
                className="w-28 accent-cyan-500 cursor-pointer"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlySponsors}
                onChange={e => setShowOnlySponsors(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
              />
              <span>{isAr ? 'الرعاة المعتمدون فقط (UK Home Office)' : 'Licensed UK Sponsors Only'}</span>
            </label>
          </div>

          <div className="text-xs text-slate-400">
            {isAr ? `عرض ${filteredJobs.length} من ${jobs.length} وظيفة مطابقة` : `Showing ${filteredJobs.length} qualified opportunities`}
          </div>
        </div>
      </div>

      {/* Jobs Stream */}
      <div className="grid grid-cols-1 gap-4">
        {filteredJobs.map(job => (
          <div
            key={job.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-all shadow-md group relative flex flex-col md:flex-row md:items-center justify-between gap-5"
          >
            {/* Left: Role Info */}
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {job.title}
                </h3>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {job.companyName}
                </span>

                {/* UK Home Office Sponsor Verification Badge */}
                {job.sponsorVerified ? (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{job.sponsorRoute || 'Skilled Worker Sponsor'}</span>
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                    <span>No Sponsor License</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {job.location} {job.isRemote && '(Remote)'}
                </span>
                {job.salaryRange && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    {job.salaryRange}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[11px] uppercase font-mono">
                  {job.source}
                </span>
              </div>

              {/* Skills Match Breakdown */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">{isAr ? 'المهارات المتطابقة:' : 'Matched:'}</span>
                {job.score.matchedSkills.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-800/60"
                  >
                    <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                    {s}
                  </span>
                ))}

                {job.score.missingSkills.length > 0 && (
                  <>
                    <span className="text-xs text-slate-500 ml-2">{isAr ? 'فجوات مفقودة:' : 'Gaps:'}</span>
                    {job.score.missingSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-950 text-rose-300 border border-rose-900/40"
                      >
                        <XCircle className="w-3 h-3 text-rose-500" />
                        {s}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Right: Score Tile & Action Button */}
            <div className="flex sm:flex-row md:flex-col items-end justify-between sm:justify-end gap-3 flex-shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-xl border font-bold text-center ${getScoreColor(job.score.totalScore)}`}>
                  <div className="text-lg leading-none">{job.score.totalScore}%</div>
                  <div className="text-[10px] uppercase tracking-wider font-mono opacity-80 mt-0.5">
                    {isAr ? 'مؤشر التوافق' : 'Fit Index'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="View original posting"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={() => onNavigateToSynthesizer(job)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-600/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAr ? 'توليد الحزمة' : 'Synthesize Pack'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredJobs.length === 0 && (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
            <Compass className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-slate-300 font-semibold text-sm">
              {isAr ? 'لا توجد وظائف تطابق الحد الأدنى للتوافق أو فلتر الكفالة' : 'No roles meet the current match threshold'}
            </h4>
            <p className="text-slate-500 text-xs mt-1">
              Try lowering the minimum match threshold or paste a custom live job posting above.
            </p>
          </div>
        )}
      </div>

      {/* Paste Live Job Modal */}
      {isPasteJobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {isAr ? 'تحليل إعلان وظيفة جديد فورياً' : 'Instant Job Ingestion'}
              </h3>
              <button onClick={() => setIsPasteJobOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handlePasteJobSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Role Title</label>
                  <input
                    type="text"
                    required
                    value={pasteTitle}
                    onChange={e => setPasteTitle(e.target.value)}
                    placeholder="e.g. Senior Go Infrastructure Engineer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Company Name</label>
                  <input
                    type="text"
                    required
                    value={pasteCompany}
                    onChange={e => setPasteCompany(e.target.value)}
                    placeholder="e.g. Stripe / Revolut Ltd"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Required Tech Stack (comma separated)</label>
                <input
                  type="text"
                  required
                  value={pasteSkills}
                  onChange={e => setPasteSkills(e.target.value)}
                  placeholder="Go, Kubernetes, PostgreSQL, Kafka, Linux"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-cyan-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Job Description / Scope</label>
                <textarea
                  rows={4}
                  value={pasteDesc}
                  onChange={e => setPasteDesc(e.target.value)}
                  placeholder="Paste snippet of the job requirements or description..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPasteJobOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg"
                >
                  Ingest & Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
