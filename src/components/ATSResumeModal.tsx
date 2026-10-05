import React from 'react';
import { CandidateProfile } from '../data/initialData';
import { VaultItem, TailoredBullet } from '../types/career';
import { Printer, Download, X, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ATSResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CandidateProfile;
  vaultItems: VaultItem[];
  tailoredBullets?: TailoredBullet[];
  targetRole?: string;
  targetCompany?: string;
  lang: 'en' | 'ar';
}

export const ATSResumeModal: React.FC<ATSResumeModalProps> = ({
  isOpen,
  onClose,
  profile,
  vaultItems,
  tailoredBullets,
  targetRole,
  targetCompany,
  lang,
}) => {
  if (!isOpen) return null;

  const isAr = lang === 'ar';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Top Modal Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-700/50">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                Single-Layer NFC Unicode ATS PDF Preview
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Clean single-column text stream. Zero invisible overlay penalties.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable ATS Document Sheet (A4 Single-Column) */}
        <div className="p-8 bg-white text-slate-900 max-h-[80vh] overflow-y-auto font-sans print:max-h-none print:p-0">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header / Contact */}
            <div className="text-center border-b border-slate-300 pb-4">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 uppercase">
                {profile.fullName}
              </h1>
              <div className="text-sm font-semibold text-slate-700 mt-1">
                {targetRole || profile.targetRole}
              </div>
              <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap items-center justify-center gap-3">
                <span>{profile.email}</span>
                <span>•</span>
                <span>{profile.phone}</span>
                <span>•</span>
                <span>London, United Kingdom</span>
                {profile.requiresSponsorship && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-indigo-700">Skilled Worker Visa Eligible</span>
                  </>
                )}
              </div>
            </div>

            {/* Target Role & Summary */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
                Executive Profile Summary
              </h2>
              <p className="text-xs text-slate-800 leading-relaxed text-justify">
                High-impact Software Engineer with {profile.yearsOfExp}+ years of verified production experience across {profile.targetDomains.join(', ')}. Demonstrated track record delivering scalable distributed microservices, low-latency APIs, and fault-tolerant cloud systems with zero downtime.
              </p>
            </div>

            {/* Core Skills */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
                Technical Skills & Competencies
              </h2>
              <p className="text-xs text-slate-800 leading-relaxed">
                <span className="font-semibold">Core Stack: </span>
                {Array.from(new Set([...profile.skills, ...vaultItems.flatMap(v => v.skills)])).join(', ')}
              </p>
            </div>

            {/* Tailored Experience Bullets */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-3">
                Professional Experience
              </h2>

              <div className="space-y-4">
                {vaultItems
                  .filter(v => v.category === 'experience')
                  .map(exp => (
                    <div key={exp.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-950">{exp.title}</span>
                        <span className="text-slate-600 font-medium">
                          {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-700 italic">
                        {exp.organization}
                      </div>

                      {/* Tailored or original verified bullets */}
                      <ul className="list-disc list-inside text-xs text-slate-800 space-y-1 pt-1">
                        {tailoredBullets && tailoredBullets.some(b => b.vault_item_id === exp.id) ? (
                          tailoredBullets
                            .filter(b => b.vault_item_id === exp.id)
                            .map((b, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {b.tailored_text}
                              </li>
                            ))
                        ) : (
                          <>
                            <li className="leading-relaxed">{exp.description}</li>
                            {exp.metrics.map((m, mIdx) => (
                              <li key={mIdx} className="leading-relaxed">
                                Successfully delivered: <span className="font-semibold">{m}</span> across production clusters.
                              </li>
                            ))}
                          </>
                        )}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>

            {/* Key Achievements & Projects */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-3">
                Key Accomplishments & Systems Engineering
              </h2>
              <div className="space-y-3">
                {vaultItems
                  .filter(v => v.category === 'achievement' || v.category === 'project')
                  .map(ach => (
                    <div key={ach.id} className="text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-950">{ach.title}</span>
                        <span className="text-slate-600">{ach.startDate}</span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">
                        • {ach.description} ({ach.metrics.join('; ')})
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {/* Education */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
                Education & Credentials
              </h2>
              {vaultItems
                .filter(v => v.category === 'education')
                .map(edu => (
                  <div key={edu.id} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-950">{edu.title}</span>
                      <span className="text-slate-700"> — {edu.organization}</span>
                    </div>
                    <span className="text-slate-600">{edu.startDate} – {edu.endDate}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
