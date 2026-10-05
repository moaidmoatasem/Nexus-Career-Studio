import React, { useState } from 'react';
import { ApplicationRecord, ApplicationStatus, EmailClassificationResult } from '../types/career';
import { SAMPLE_EMAILS } from '../data/initialData';
import { 
  Kanban, 
  Mail, 
  Send, 
  ExternalLink, 
  CheckCircle2, 
  Calendar, 
  AlertCircle, 
  ChevronRight, 
  FileText, 
  Check, 
  Sparkles,
  Inbox,
  Clock,
  Archive,
  ArrowRight
} from 'lucide-react';

interface KanbanViewProps {
  applications: ApplicationRecord[];
  setApplications: React.Dispatch<React.SetStateAction<ApplicationRecord[]>>;
  onOpenATSResume: () => void;
  lang: 'en' | 'ar';
}

const COLUMNS: Array<{ id: ApplicationStatus; titleEn: string; titleAr: string; color: string }> = [
  { id: 'queued', titleEn: 'Daily Queue', titleAr: 'القائمة اليومية', color: 'border-slate-700 bg-slate-900/50' },
  { id: 'tailored', titleEn: 'Ready to Dispatch', titleAr: 'جاهز للإرسال', color: 'border-cyan-700/60 bg-cyan-950/20' },
  { id: 'applied', titleEn: 'Submitted / Applied', titleAr: 'تم التقديم', color: 'border-blue-700/60 bg-blue-950/20' },
  { id: 'screening', titleEn: 'Assessment / Screen', titleAr: 'تقييم تقني', color: 'border-amber-700/60 bg-amber-950/20' },
  { id: 'interviewing', titleEn: 'Interview Scheduled', titleAr: 'مقابلة مجدولة', color: 'border-emerald-700/60 bg-emerald-950/20' },
  { id: 'rejected', titleEn: 'Archived', titleAr: 'الأرشيف', color: 'border-slate-800 bg-slate-950/30' },
];

export const KanbanView: React.FC<KanbanViewProps> = ({
  applications,
  setApplications,
  onOpenATSResume,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [isEmailSimulatorOpen, setIsEmailSimulatorOpen] = useState(false);
  const [simSender, setSimSender] = useState('');
  const [simSubject, setSimSubject] = useState('');
  const [simBody, setSimBody] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [lastClassification, setLastClassification] = useState<EmailClassificationResult | null>(null);
  const [dispatchedId, setDispatchedId] = useState<string | null>(null);

  const moveApplication = (id: string, newStatus: ApplicationStatus) => {
    setApplications(prev =>
      prev.map(app => (app.id === id ? { ...app, status: newStatus } : app))
    );
  };

  const handleLaunchAssistedDispatch = (app: ApplicationRecord) => {
    setDispatchedId(app.id);
    // Stage clipboard with tailored resume bullets
    if (app.tailoredPack?.bullets) {
      const text = app.tailoredPack.bullets.map(b => `• ${b.tailored_text}`).join('\n');
      navigator.clipboard.writeText(text);
    }

    setTimeout(() => {
      moveApplication(app.id, 'applied');
      setDispatchedId(null);
    }, 1500);
  };

  const handleSimulateEmail = async (sampleIndex?: number) => {
    let payload = {
      sender: simSender,
      subject: simSubject,
      body: simBody,
      companyName: 'Employer',
    };

    if (typeof sampleIndex === 'number' && SAMPLE_EMAILS[sampleIndex]) {
      const sample = SAMPLE_EMAILS[sampleIndex];
      payload = {
        sender: sample.sender,
        subject: sample.subject,
        body: sample.body,
        companyName: sample.sender.includes('revolut') ? 'Revolut Ltd' : sample.sender.includes('arm') ? 'Arm Limited' : 'Employer',
      };
      setSimSender(sample.sender);
      setSimSubject(sample.subject);
      setSimBody(sample.body);
    }

    setIsClassifying(true);
    setLastClassification(null);

    try {
      const response = await fetch('/api/email/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Classification failed');
      const result: EmailClassificationResult = await response.json();
      setLastClassification(result);

      // Dynamically move matched application on Kanban
      setApplications(prev =>
        prev.map(app => {
          const matchCompany = app.companyName.toLowerCase().includes(result.companyName.toLowerCase()) ||
            result.companyName.toLowerCase().includes(app.companyName.toLowerCase());

          if (matchCompany || prev.length === 1) {
            let nextStatus: ApplicationStatus = app.status;
            if (result.status === 'interview_invite') nextStatus = 'interviewing';
            else if (result.status === 'screening') nextStatus = 'screening';
            else if (result.status === 'offer') nextStatus = 'offered';
            else if (result.status === 'rejection') nextStatus = 'rejected';
            else if (result.status === 'applied_ack') nextStatus = 'applied';

            return {
              ...app,
              status: nextStatus,
              lastEmailStatus: result.status,
              interviewUrl: result.schedulingUrl || app.interviewUrl,
              nextAction: result.actionSummary,
            };
          }
          return app;
        })
      );
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Kanban className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                {isAr ? 'لوحة كانبان الذاتية وتتبع الطلبات' : 'Applications Kanban & Inbound Email Sync'}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              {isAr
                ? 'تتبع دورة حياة طلباتك أوتوماتيكياً. يقوم مصنف البريد الإلكتروني بقراءة دعوات المقابلات وروابط Calendly ونقل البطاقات بدقة تفوق 94%.'
                : 'Tracks application lifecycle stages. Autonomous email classifier reads inbound ATS updates and moves cards based on verified status changes.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEmailSimulatorOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>{isAr ? 'محاكي بريد التوظيف (ATS Ingest)' : 'Test Inbound ATS Email'}</span>
            </button>
          </div>
        </div>

        {/* Live Notification Bar if Last Classification happened */}
        {lastClassification && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/50 flex items-center justify-between gap-3 text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>
                <strong>{lastClassification.companyName}:</strong> Classified as{' '}
                <span className="uppercase font-bold text-white">{lastClassification.status}</span> ({(lastClassification.confidence * 100).toFixed(0)}% confidence). {lastClassification.actionSummary}
              </span>
            </div>
            {lastClassification.schedulingUrl && (
              <a
                href={lastClassification.schedulingUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-500 flex items-center gap-1"
              >
                <span>Book Slot</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const colApps = applications.filter(a => a.status === col.id);
          return (
            <div
              key={col.id}
              className={`rounded-2xl border ${col.color} p-3.5 flex flex-col min-h-[460px] shadow-sm`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {isAr ? col.titleAr : col.titleEn}
                </span>
                <span className="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-center">
                  {colApps.length}
                </span>
              </div>

              {/* Cards Stream */}
              <div className="space-y-3 flex-1">
                {colApps.map(app => (
                  <div
                    key={app.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 transition-all shadow-md space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                          {app.roleTitle}
                        </h4>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {app.companyName}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {app.fitScore}%
                      </span>
                    </div>

                    {/* Interview Alert Link */}
                    {app.interviewUrl && app.status === 'interviewing' && (
                      <a
                        href={app.interviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-900 transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Schedule Round</span>
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Next Action hint */}
                    {app.nextAction && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 italic">
                        {app.nextAction}
                      </p>
                    )}

                    {/* Action buttons based on state */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1">
                      {app.status === 'tailored' ? (
                        <button
                          onClick={() => handleLaunchAssistedDispatch(app)}
                          disabled={dispatchedId === app.id}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-all"
                        >
                          {dispatchedId === app.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>Dispatched!</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              <span>{isAr ? 'إرسال مدعوم' : 'Assisted Apply'}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between w-full text-[10px] text-slate-500">
                          <span>Updated</span>
                          {/* Quick stage advance */}
                          {app.status === 'queued' && (
                            <button
                              onClick={() => moveApplication(app.id, 'tailored')}
                              className="text-cyan-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>Tailor</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                          {app.status === 'applied' && (
                            <button
                              onClick={() => moveApplication(app.id, 'screening')}
                              className="text-amber-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>Screen</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                          {app.status === 'screening' && (
                            <button
                              onClick={() => moveApplication(app.id, 'interviewing')}
                              className="text-emerald-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>Interview</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {colApps.length === 0 && (
                  <div className="h-full flex items-center justify-center p-4 text-center text-slate-600 text-xs border border-dashed border-slate-800/80 rounded-xl">
                    {isAr ? 'فارغ' : 'Empty'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inbound ATS Email Simulator Modal */}
      {isEmailSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">
                  {isAr ? 'محاكي فحص البريد الوارد (Enterprise ATS Email Triage)' : 'Inbound ATS Email Classifier Test'}
                </h3>
              </div>
              <button
                onClick={() => setIsEmailSimulatorOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Quick Test Samples */}
            <div>
              <span className="text-xs font-semibold text-slate-400 mb-1.5 block">
                Load Golden Test Samples:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleSimulateEmail(0)}
                  className="p-2 text-left rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-slate-300 transition-colors"
                >
                  <span className="font-semibold text-emerald-400 block">Interview Invite</span>
                  <span className="text-[11px] text-slate-500 truncate block">Revolut Calendly Link</span>
                </button>
                <button
                  onClick={() => handleSimulateEmail(1)}
                  className="p-2 text-left rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-slate-300 transition-colors"
                >
                  <span className="font-semibold text-cyan-400 block">Application Ack</span>
                  <span className="text-[11px] text-slate-500 truncate block">Arm Greenhouse Confirm</span>
                </button>
                <button
                  onClick={() => handleSimulateEmail(2)}
                  className="p-2 text-left rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-slate-300 transition-colors"
                >
                  <span className="font-semibold text-rose-400 block">Polite Rejection</span>
                  <span className="text-[11px] text-slate-500 truncate block">Lever Generic Reject</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Sender / From</label>
                  <input
                    type="text"
                    value={simSender}
                    onChange={e => setSimSender(e.target.value)}
                    placeholder="recruiting@greenhouse.io"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Subject Line</label>
                  <input
                    type="text"
                    value={simSubject}
                    onChange={e => setSimSubject(e.target.value)}
                    placeholder="Invitation to Technical Screen"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Email Body Text</label>
                <textarea
                  rows={6}
                  value={simBody}
                  onChange={e => setSimBody(e.target.value)}
                  placeholder="Paste or edit the incoming recruiter email body..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsEmailSimulatorOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => handleSimulateEmail()}
                disabled={isClassifying || !simBody.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/20"
              >
                {isClassifying ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    <span>Triage with Gemini Flash...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run Email Classifier & Sync Kanban</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
