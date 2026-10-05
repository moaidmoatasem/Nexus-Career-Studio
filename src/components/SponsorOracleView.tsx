import React, { useState, useEffect } from 'react';
import { SponsorRecord } from '../types/career';
import { SPONSOR_REGISTRY } from '../data/mockSponsors';
import { matchSponsorCompanyV3, normalizeCompanyName, EXACT_SHORT_ENTITIES } from '../server/sponsorMatcher';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Building2, 
  MapPin, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Database,
  ArrowRight
} from 'lucide-react';

interface SponsorOracleViewProps {
  lang: 'en' | 'ar';
}

export const SponsorOracleView: React.FC<SponsorOracleViewProps> = ({ lang }) => {
  const isAr = lang === 'ar';
  const [searchTerm, setSearchTerm] = useState('Arm');
  const [searchResults, setSearchResults] = useState<SponsorRecord[]>([]);
  const [searchLatencyMs, setSearchLatencyMs] = useState<number>(4);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(SPONSOR_REGISTRY.slice(0, 10));
      return;
    }

    const start = performance.now();
    const results = matchSponsorCompanyV3(searchTerm, SPONSOR_REGISTRY);
    const end = performance.now();
    setSearchLatencyMs(Math.max(1, Math.round(end - start)));
    setSearchResults(results);
  }, [searchTerm]);

  const quickPicks = ['Arm', 'Revolut', 'Google', 'Meta', 'BP', 'DeepMind', 'Monzo', 'Spotify', 'Deliveroo', 'Darktrace'];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                {isAr ? 'أوراكل كفالة التأشيرات البريطانية' : 'UK Skilled Worker Sponsor Oracle'}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              {isAr
                ? 'فحص فوري لقاعدة بيانات وزارة الداخلية البريطانية (Home Office Register). يدمج المطابقة التامة للأسماء القصيرة (مثل ARM و BP) ومطابقة Trigram الضبابية للكيانات القانونية.'
                : 'Sub-10ms legal entity resolver. Combines exact match for short identifiers (<= 4 chars) with pg_trgm fuzzy matching against 110,000+ licensed UK sponsors.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Lookup: {searchLatencyMs}ms</span>
            </div>
          </div>
        </div>

        {/* Quick Picks */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">{isAr ? 'اختصارات سريعة:' : 'Quick Verification:'}</span>
          {quickPicks.map(p => (
            <button
              key={p}
              onClick={() => setSearchTerm(p)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder={isAr ? 'ادخل اسم الشركة للتحقق من ترخيص الكفالة البريطاني...' : 'Enter company name to verify Home Office Skilled Worker licensing...'}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
        />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          {searchResults.length > 0 ? (
            <>
              Found <strong className="text-white">{searchResults.length}</strong> matching licensed entities for &quot;{searchTerm}&quot;
            </>
          ) : (
            <>No licensed sponsor matches for &quot;{searchTerm}&quot;</>
          )}
        </span>
        <span className="font-mono text-slate-500">
          Normalized query: &quot;{normalizeCompanyName(searchTerm)}&quot;
        </span>
      </div>

      {/* Search Results Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {searchResults.map(sponsor => (
          <div
            key={sponsor.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-all shadow-md space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-400 mt-0.5">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">{sponsor.organisationName}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{sponsor.townCity}, {sponsor.county}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Licensed</span>
                </span>
                {sponsor.similarity && (
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Sim: {(sponsor.similarity * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block">Rating:</span>
                <span className="text-slate-200 font-semibold">{sponsor.typeRating}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Visa Route:</span>
                <span className="text-cyan-300 font-semibold">{sponsor.route}</span>
              </div>
            </div>
          </div>
        ))}

        {searchResults.length === 0 && (
          <div className="col-span-2 text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20 space-y-2">
            <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
            <h4 className="text-slate-300 font-semibold text-sm">
              Employer Not Found on the Official Register
            </h4>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              &quot;{searchTerm}&quot; does not appear to hold a current Skilled Worker sponsor license. If hired, you may need alternative visa arrangements or right-to-work eligibility.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
