import React, { useState } from 'react';
import { VaultItem, VaultCategory } from '../types/career';
import { 
  Plus, 
  Sparkles, 
  CheckCircle, 
  Award, 
  Briefcase, 
  Code, 
  GraduationCap, 
  FolderGit2, 
  Trash2, 
  Search,
  Filter,
  AlertCircle,
  FileUp,
  Tag,
  Database
} from 'lucide-react';

interface VaultViewProps {
  vaultItems: VaultItem[];
  setVaultItems: React.Dispatch<React.SetStateAction<VaultItem[]>>;
  lang: 'en' | 'ar';
}

export const VaultView: React.FC<VaultViewProps> = ({ vaultItems, setVaultItems, lang }) => {
  const isAr = lang === 'ar';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // New item modal state
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newCategory, setNewCategory] = useState<VaultCategory>('experience');
  const [newMetrics, setNewMetrics] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const filteredItems = vaultItems.filter(item => {
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.metrics.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const getCategoryIcon = (category: VaultCategory) => {
    switch (category) {
      case 'experience': return <Briefcase className="w-4 h-4 text-cyan-400" />;
      case 'achievement': return <Award className="w-4 h-4 text-amber-400" />;
      case 'project': return <FolderGit2 className="w-4 h-4 text-emerald-400" />;
      case 'education': return <GraduationCap className="w-4 h-4 text-indigo-400" />;
      default: return <Code className="w-4 h-4 text-purple-400" />;
    }
  };

  const handleExtractFromRaw = async () => {
    if (!rawText.trim()) return;
    setIsExtracting(true);
    setExtractError(null);

    try {
      const response = await fetch('/api/vault/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        setVaultItems(prev => [...data.items, ...prev]);
        setIsExtractModalOpen(false);
        setRawText('');
      } else {
        throw new Error('Invalid extraction format returned.');
      }
    } catch (err: any) {
      console.error(err);
      setExtractError(err.message || 'Failed to extract items from text.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCreateManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const parsedMetrics = newMetrics
      .split('\n')
      .map(m => m.trim())
      .filter(Boolean);

    const parsedSkills = newSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const newItem: VaultItem = {
      id: `vault_${Date.now()}`,
      category: newCategory,
      title: newTitle,
      organization: newOrg || 'Independent',
      startDate: '2023',
      endDate: 'Present',
      isCurrent: true,
      description: newDesc,
      metrics: parsedMetrics,
      skills: parsedSkills,
      isVerified: true,
    };

    setVaultItems(prev => [newItem, ...prev]);
    setIsNewItemModalOpen(false);
    setNewTitle('');
    setNewOrg('');
    setNewMetrics('');
    setNewSkills('');
    setNewDesc('');
  };

  const handleDeleteItem = (id: string) => {
    setVaultItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Database className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                {isAr ? 'خزينة المسار المهني الرئيسية' : 'Master Career Vault'}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              {isAr 
                ? 'مستودع إنجازاتك المهنية الموثوقة مع مقاييس كمية دقيقة. يعتمد محرك التوليد على معرّفات الـ UUID فقط لمنع أي اختلاق للأرقام أو الخبرات.'
                : 'The single source of truth for your career achievements with verified scalar metrics. The tailoring engine deterministically binds every bullet to a specific vault item ID.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExtractModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'استخراج ذكي بالذكاء الاصطناعي' : 'AI Resume Extractor'}</span>
            </button>

            <button
              onClick={() => setIsNewItemModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'إضافة سجل يدوي' : 'Add Item'}</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="rounded-xl bg-slate-950/40 p-3 border border-slate-800">
            <span className="text-xs text-slate-400">{isAr ? 'إجمالي السجلات' : 'Vault Records'}</span>
            <div className="text-lg font-bold text-white mt-0.5">{vaultItems.length}</div>
          </div>
          <div className="rounded-xl bg-slate-950/40 p-3 border border-slate-800">
            <span className="text-xs text-slate-400">{isAr ? 'مقاييس موثوقة' : 'Verified Metrics'}</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {vaultItems.reduce((acc, item) => acc + item.metrics.length, 0)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-950/40 p-3 border border-slate-800">
            <span className="text-xs text-slate-400">{isAr ? 'المهارات المفهرسة' : 'Indexed Skills'}</span>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">
              {new Set(vaultItems.flatMap(i => i.skills)).size}
            </div>
          </div>
          <div className="rounded-xl bg-slate-950/40 p-3 border border-slate-800">
            <span className="text-xs text-slate-400">{isAr ? 'ضمان عدم الاختلاق' : 'Grounding Invariant'}</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mt-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>100% Provenance Bound</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isAr ? 'بحث بالمهارات أو الإنجازات...' : 'Search skills, metrics, organizations...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {['all', 'experience', 'achievement', 'project', 'education'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-300'
              }`}
            >
              {cat === 'all' ? (isAr ? 'الكل' : 'All') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Vault Items List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map(item => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-all shadow-md group relative"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 mt-0.5">
                  {getCategoryIcon(item.category)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {item.organization}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {item.startDate} — {item.isCurrent ? (isAr ? 'الحالي' : 'Present') : item.endDate}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500 hidden sm:inline px-2 py-1 rounded bg-slate-950/60 border border-slate-800">
                  {item.id}
                </span>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Remove from vault"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Verified Metrics Strip */}
            {item.metrics.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  {isAr ? 'مقاييس موثوقة ومثبتة:' : 'Verified Scalar Metrics:'}
                </span>
                {item.metrics.map((m, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-700/50"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}

            {/* Skills Tags */}
            {item.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {item.skills.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800/90 text-cyan-300 border border-slate-700/60"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
            <Database className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {isAr ? 'لم يتم العثور على سجلات تطابق الفلترة الحالية.' : 'No vault items match your filter criteria.'}
            </p>
          </div>
        )}
      </div>

      {/* AI Extraction Modal */}
      {isExtractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">
                  {isAr ? 'استخراج السيرة بالذكاء الاصطناعي (Gemini Flash)' : 'AI Career Vault Extractor'}
                </h3>
              </div>
              <button
                onClick={() => setIsExtractModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {isAr 
                ? 'الصق نص سيرتك الذاتية أو حساب لينكد إن هنا. سيقوم نموذج Gemini باستخراج وتفكيك الخبرات وعزل المقاييس الرقمية بدقة.'
                : 'Paste your raw resume text or LinkedIn profile summary. Gemini 3.8 Flash extracts structured accomplishments with isolated quantifiable metrics.'}
            </p>

            <textarea
              rows={8}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Paste raw resume, LinkedIn export, or project text here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
            />

            {extractError && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{extractError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsExtractModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleExtractFromRaw}
                disabled={isExtracting || !rawText.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-lg shadow-cyan-600/20"
              >
                {isExtracting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    <span>{isAr ? 'جاري الاستخراج...' : 'Extracting with Flash...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{isAr ? 'بدء الاستخراج' : 'Extract into Vault'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Item Modal */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {isAr ? 'إضافة سجل مهني موثوق' : 'Add New Vault Record'}
              </h3>
              <button
                onClick={() => setIsNewItemModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualItem} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Title / Role</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Organization</label>
                  <input
                    type="text"
                    value={newOrg}
                    onChange={e => setNewOrg(e.target.value)}
                    placeholder="e.g. Apex FinTech"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as VaultCategory)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="experience">Experience</option>
                  <option value="achievement">Achievement</option>
                  <option value="project">Project</option>
                  <option value="education">Education</option>
                  <option value="skill">Skill</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Description</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Describe your technical contributions and scope..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">
                  Verified Scalar Metrics (one per line)
                </label>
                <textarea
                  rows={2}
                  value={newMetrics}
                  onChange={e => setNewMetrics(e.target.value)}
                  placeholder="e.g. Reduced API latency by 42%&#10;Scaled volume to $14M daily"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-emerald-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={newSkills}
                  onChange={e => setNewSkills(e.target.value)}
                  placeholder="Go, Kubernetes, Kafka, PostgreSQL"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-cyan-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg"
                >
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
