import React, { useState } from 'react';
import { Navbar, StudioTab } from './components/Navbar';
import { VaultView } from './components/VaultView';
import { RoleRadarView } from './components/RoleRadarView';
import { SynthesizerView } from './components/SynthesizerView';
import { KanbanView } from './components/KanbanView';
import { SponsorOracleView } from './components/SponsorOracleView';
import { LovableTransitionHub } from './components/LovableTransitionHub';
import { ATSResumeModal } from './components/ATSResumeModal';
import { 
  INITIAL_PROFILE, 
  INITIAL_VAULT_ITEMS, 
  INITIAL_JOB_POSTINGS, 
  INITIAL_APPLICATIONS 
} from './data/initialData';
import { JobPosting, VaultItem, ApplicationRecord } from './types/career';

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('radar');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [radarActive, setRadarActive] = useState<boolean>(true);
  const [requiresSponsorship, setRequiresSponsorship] = useState<boolean>(true);

  // Core application state
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>(INITIAL_VAULT_ITEMS);
  const [jobs, setJobs] = useState<JobPosting[]>(INITIAL_JOB_POSTINGS);
  const [applications, setApplications] = useState<ApplicationRecord[]>(INITIAL_APPLICATIONS);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(INITIAL_JOB_POSTINGS[0]);
  const [isATSModalOpen, setIsATSModalOpen] = useState(false);

  const handleNavigateToSynthesizer = (job: JobPosting) => {
    setSelectedJob(job);
    setActiveTab('synthesizer');
  };

  const isAr = lang === 'ar';

  return (
    <div 
      dir={isAr ? 'rtl' : 'ltr'} 
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans ${isAr ? 'font-[Cairo]' : 'font-[Inter]'}`}
    >
      {/* Top Studio Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        radarActive={radarActive}
        setRadarActive={setRadarActive}
        requiresSponsorship={requiresSponsorship}
        setRequiresSponsorship={setRequiresSponsorship}
        lang={lang}
        setLang={setLang}
        onOpenATSModal={() => setIsATSModalOpen(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'radar' && (
          <RoleRadarView
            jobs={jobs}
            setJobs={setJobs}
            profile={profile}
            vaultItems={vaultItems}
            applications={applications}
            setApplications={setApplications}
            requiresSponsorship={requiresSponsorship}
            onNavigateToSynthesizer={handleNavigateToSynthesizer}
            lang={lang}
          />
        )}

        {activeTab === 'vault' && (
          <VaultView
            vaultItems={vaultItems}
            setVaultItems={setVaultItems}
            lang={lang}
          />
        )}

        {activeTab === 'synthesizer' && (
          <SynthesizerView
            selectedJob={selectedJob}
            jobs={jobs}
            setSelectedJob={setSelectedJob}
            vaultItems={vaultItems}
            applications={applications}
            setApplications={setApplications}
            onOpenATSResume={() => setIsATSModalOpen(true)}
            lang={lang}
          />
        )}

        {activeTab === 'kanban' && (
          <KanbanView
            applications={applications}
            setApplications={setApplications}
            onOpenATSResume={() => setIsATSModalOpen(true)}
            lang={lang}
          />
        )}

        {activeTab === 'oracle' && (
          <SponsorOracleView
            lang={lang}
          />
        )}

        {activeTab === 'lovable' && (
          <LovableTransitionHub
            lang={lang}
          />
        )}
      </main>

      {/* Single-Layer ATS PDF Resume Previewer */}
      <ATSResumeModal
        isOpen={isATSModalOpen}
        onClose={() => setIsATSModalOpen(false)}
        profile={profile}
        vaultItems={vaultItems}
        targetRole={selectedJob?.title}
        targetCompany={selectedJob?.companyName}
        lang={lang}
      />

      {/* Studio Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Cherenkov Nexus Career Studio</span>
            <span>•</span>
            <span>Zero-Hallucination Career Autopilot</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>Phase 1 (Google AI Studio) Prototype</span>
            <span>•</span>
            <span className="text-purple-400">Lovable Cloud / Supabase Target Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
