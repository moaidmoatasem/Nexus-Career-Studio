import React from 'react';
import { 
  Compass, 
  Database, 
  FileText, 
  Kanban, 
  ShieldCheck, 
  Layers, 
  Globe, 
  Radio, 
  Sparkles,
  CheckCircle2,
  PauseCircle
} from 'lucide-react';

export type StudioTab = 'radar' | 'vault' | 'synthesizer' | 'kanban' | 'oracle' | 'lovable';

interface NavbarProps {
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  radarActive: boolean;
  setRadarActive: (active: boolean) => void;
  requiresSponsorship: boolean;
  setRequiresSponsorship: (req: boolean) => void;
  lang: 'en' | 'ar';
  setLang: (lang: 'en' | 'ar') => void;
  onOpenATSModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  radarActive,
  setRadarActive,
  requiresSponsorship,
  setRequiresSponsorship,
  lang,
  setLang,
  onOpenATSModal
}) => {
  const isAr = lang === 'ar';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-cyan-400/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  Cherenkov Nexus
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-950 border border-cyan-700/60 text-cyan-300">
                  Career Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                {isAr ? 'وكيل التوظيف الذاتي ومطابقة الكفالة والوظائف' : 'Autonomous Job Hunter & Zero-Hallucination Synthesizer'}
              </p>
            </div>
          </div>

          {/* Controls: Radar toggle, Visa toggle, Language toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Radar Toggle */}
            <button
              onClick={() => setRadarActive(!radarActive)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                radarActive
                  ? 'bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-900 border border-slate-700 text-slate-400'
              }`}
              title={isAr ? 'حالة رادار الوظائف التلقائي' : 'Autonomous Background Role Radar'}
            >
              {radarActive ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="hidden md:inline">{isAr ? 'الرادار نشط' : 'Radar: Active'}</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden md:inline">{isAr ? 'الرادار متوقف' : 'Radar: Paused'}</span>
                </>
              )}
            </button>

            {/* Visa Oracle Filter Toggle */}
            <button
              onClick={() => setRequiresSponsorship(!requiresSponsorship)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                requiresSponsorship
                  ? 'bg-indigo-950/80 border border-indigo-500/60 text-indigo-300'
                  : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
              title={isAr ? 'تفعيل فلترة كفالة التأشيرات البريطانية' : 'UK Skilled Worker Sponsor Filter'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">
                {requiresSponsorship ? (isAr ? 'كفالة UK مطلوبة' : 'Visa Oracle: Required') : (isAr ? 'كل الوظائف' : 'All Roles')}
              </span>
            </button>

            {/* ATS Resume Preview Modal Button */}
            <button
              onClick={onOpenATSModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">{isAr ? 'معاينة السيرة ATS' : 'ATS Resume'}</span>
            </button>

            {/* Language Toggle (EN / AR) */}
            <button
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-2 border-t border-slate-800/80 overflow-x-auto py-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'radar'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{isAr ? 'رادار الوظائف' : 'Role Radar'}</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'vault'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{isAr ? 'خزينة المسار المهني' : 'Career Vault'}</span>
          </button>

          <button
            onClick={() => setActiveTab('synthesizer')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'synthesizer'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isAr ? 'مخصص السيرة الذاتية' : 'Zero-Hallucination Synthesizer'}</span>
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'kanban'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Kanban className="w-4 h-4" />
            <span>{isAr ? 'متابعة الطلبات (كانبان)' : 'Applications Kanban'}</span>
          </button>

          <button
            onClick={() => setActiveTab('oracle')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'oracle'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isAr ? 'أوراكل الكفالة البريطانية' : 'UK Sponsor Oracle'}</span>
          </button>

          <button
            onClick={() => setActiveTab('lovable')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'lovable'
                ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Layers className="w-4 h-4 text-pink-400" />
            <span>{isAr ? 'مخطط الانتقال لـ Lovable' : 'Lovable Transition Blueprint'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
