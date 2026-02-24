'use client';

import { useEffect, useState, useCallback } from 'react';

interface ClassInfo {
  id: number;
  name: string;
  periods: string | null;
  color: string | null;
}

type AIProvider = 'gemini' | 'anthropic';

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Free)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Cheapest)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (Best)' },
];

function parsePeriodsToNumbers(periodsStr: string | null, maxPeriod = 10): number[] {
  if (!periodsStr) return [];
  const nums: number[] = [];
  // Split on common separators and extract individual numbers
  const parts = periodsStr.split(/[,\s]+/);
  for (const part of parts) {
    // Extract leading digits from each part (e.g., "1st" -> 1, "3rd" -> 3)
    const match = part.match(/^(\d+)/);
    if (match) {
      const n = parseInt(match[1]);
      if (!isNaN(n) && n >= 1 && n <= maxPeriod) nums.push(n);
    }
  }
  return [...new Set(nums)];
}

function periodsNumbersToString(nums: number[]): string {
  if (nums.length === 0) return '';
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  if (sorted.length === 1) return ordinal(sorted[0]);
  if (sorted.length === 2) return `${ordinal(sorted[0])} and ${ordinal(sorted[1])}`;
  return sorted.slice(0, -1).map(ordinal).join(', ') + ', and ' + ordinal(sorted[sorted.length - 1]);
}

export default function SettingsPage() {
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash-lite');
  const [anthropicModel, setAnthropicModel] = useState('claude-sonnet-4-20250514');
  const [schoolName, setSchoolName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [seedingCalendar, setSeedingCalendar] = useState(false);

  const showToast = useCallback((msg: string, err?: boolean) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, classesRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/classes'),
        ]);
        const settings = await settingsRes.json();
        const cls = await classesRes.json();

        setProvider((settings.ai_provider as AIProvider) || 'gemini');
        setGeminiKey(settings.gemini_api_key || '');
        setAnthropicKey(settings.anthropic_api_key || '');
        setGeminiModel(settings.gemini_model || 'gemini-2.0-flash-lite');
        setAnthropicModel(settings.anthropic_model || 'claude-sonnet-4-20250514');
        setSchoolName(settings.school_name || '');
        setTeacherName(settings.teacher_name || '');
        setSchoolYear(settings.school_year || '');
        setPeriodsPerDay(parseInt(settings.periods_per_day) || 7);
        setClasses(cls || []);
      } catch { /* ignore */ }
    }
    load();
  }, []);

  async function saveSchoolInfo() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_name: schoolName,
        teacher_name: teacherName,
        school_year: schoolYear,
        periods_per_day: String(periodsPerDay),
      }),
    });
    showToast('School info saved!');
  }

  async function saveAISettings() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ai_provider: provider,
        gemini_api_key: geminiKey,
        anthropic_api_key: anthropicKey,
        gemini_model: geminiModel,
        anthropic_model: anthropicModel,
      }),
    });
    showToast('AI settings saved!');
  }

  async function updateClass(id: number, field: string, value: string) {
    setClasses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    await fetch(`/api/classes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  function togglePeriod(classId: number, period: number) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    const current = parsePeriodsToNumbers(cls.periods, periodsPerDay);
    const next = current.includes(period)
      ? current.filter(p => p !== period)
      : [...current, period];
    const newStr = periodsNumbersToString(next);
    updateClass(classId, 'periods', newStr);
  }

  async function addClass() {
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Class', periods: '', color: '#4ECDC4' }),
    });
    if (res.ok) {
      const cls = await res.json();
      if (cls.id) {
        setClasses(prev => [...prev, cls]);
        showToast('Class added!');
      }
    }
  }

  async function deleteClass(id: number) {
    const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setClasses(prev => prev.filter(c => c.id !== id));
      showToast('Class removed.');
    } else {
      const data = await res.json().catch(() => ({ error: 'Delete failed' }));
      showToast(data.error || 'Failed to delete class', true);
    }
  }

  async function seedCalendar() {
    setSeedingCalendar(true);
    try {
      const res = await fetch('/api/calendar/seed', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || `Seeded ${data.seeded} events`);
    } catch {
      showToast('Failed to seed calendar', true);
    }
    setSeedingCalendar(false);
  }

  const inputCls = 'w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none';
  const labelCls = 'block text-xs uppercase tracking-wider text-accent font-semibold mb-1';
  const btnCls = 'px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110';

  const periodNumbers = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  return (
    <div className="max-w-[800px] mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      {/* School Info */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">School Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={labelCls}>School Name</label>
            <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Teacher Name</label>
            <input type="text" value={teacherName} onChange={e => setTeacherName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>School Year</label>
            <input type="text" value={schoolYear} onChange={e => setSchoolYear(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mb-4">
          <label className={labelCls}>Periods Per Day</label>
          <select
            value={periodsPerDay}
            onChange={e => setPeriodsPerDay(parseInt(e.target.value))}
            className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
          >
            {[4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n} periods</option>
            ))}
          </select>
        </div>
        <button onClick={saveSchoolInfo} className={btnCls}>
          Save Info
        </button>
      </div>

      {/* Classes */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Classes</h2>
          <button onClick={addClass} className={btnCls}>
            + Add Class
          </button>
        </div>
        <div className="space-y-5">
          {classes.map(cls => {
            const selectedPeriods = parsePeriodsToNumbers(cls.periods, periodsPerDay);
            return (
              <div key={cls.id} className="rounded-lg bg-bg-secondary border border-border/50 p-4">
                <div className="flex gap-3 items-start group mb-3">
                  <input
                    type="color"
                    value={cls.color || '#4ECDC4'}
                    onChange={e => updateClass(cls.id, 'color', e.target.value)}
                    className="w-10 h-10 rounded border border-border cursor-pointer shrink-0"
                  />
                  <div className="flex-1">
                    <label className={labelCls}>Class Name</label>
                    <input
                      type="text"
                      value={cls.name}
                      onChange={e => updateClass(cls.id, 'name', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <button onClick={() => deleteClass(cls.id)}
                    className="text-accent-red opacity-0 group-hover:opacity-100 text-sm mt-6 shrink-0 transition-opacity hover:underline">
                    Remove
                  </button>
                </div>
                <div>
                  <label className={labelCls}>Periods</label>
                  <div className="flex flex-wrap gap-1.5">
                    {periodNumbers.map(p => (
                      <button
                        key={p}
                        onClick={() => togglePeriod(cls.id, p)}
                        className={`w-9 h-9 rounded-lg font-semibold text-sm transition-all ${
                          selectedPeriods.includes(p)
                            ? 'text-white'
                            : 'bg-bg-input text-text-muted border border-border hover:border-accent'
                        }`}
                        style={selectedPeriods.includes(p) ? { backgroundColor: cls.color || '#4ECDC4' } : undefined}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  {selectedPeriods.length > 0 && (
                    <p className="text-xs text-text-muted mt-1.5">
                      {periodsNumbersToString(selectedPeriods)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {classes.length === 0 && <p className="text-sm text-text-muted">No classes configured. Click &quot;+ Add Class&quot; to get started.</p>}
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Calendar</h2>
        <p className="text-sm text-text-secondary mb-3">
          Import the school calendar to populate holidays, breaks, and events.
        </p>
        <button onClick={seedCalendar} disabled={seedingCalendar} className={btnCls}>
          {seedingCalendar ? 'Importing...' : 'Import School Calendar'}
        </button>
      </div>

      {/* AI Provider */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">AI Provider</h2>

        {/* Provider Toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setProvider('gemini')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              provider === 'gemini'
                ? 'bg-accent text-bg-primary'
                : 'bg-bg-input text-text-muted border border-border hover:border-accent'
            }`}
          >
            Google Gemini
          </button>
          <button
            onClick={() => setProvider('anthropic')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              provider === 'anthropic'
                ? 'bg-accent text-bg-primary'
                : 'bg-bg-input text-text-muted border border-border hover:border-accent'
            }`}
          >
            Anthropic Claude
          </button>
        </div>

        {/* Gemini Settings */}
        <div className={`space-y-3 ${provider === 'gemini' ? '' : 'opacity-40 pointer-events-none'}`}>
          <div>
            <label className={labelCls}>Gemini API Key</label>
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="Enter your Gemini API key..."
              className={inputCls}
            />
            <p className="text-xs text-text-muted mt-1">
              Get your key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">Google AI Studio</a>
            </p>
          </div>
          <div>
            <label className={labelCls}>Gemini Model</label>
            <select value={geminiModel} onChange={e => setGeminiModel(e.target.value)} className={inputCls}>
              {GEMINI_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Anthropic Settings */}
        <div className={`space-y-3 mt-4 ${provider === 'anthropic' ? '' : 'opacity-40 pointer-events-none'}`}>
          <div>
            <label className={labelCls}>Anthropic API Key</label>
            <input
              type="password"
              value={anthropicKey}
              onChange={e => setAnthropicKey(e.target.value)}
              placeholder="Enter your Anthropic API key..."
              className={inputCls}
            />
            <p className="text-xs text-text-muted mt-1">
              Get your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">Anthropic Console</a>
            </p>
          </div>
          <div>
            <label className={labelCls}>Claude Model</label>
            <select value={anthropicModel} onChange={e => setAnthropicModel(e.target.value)} className={inputCls}>
              {ANTHROPIC_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={saveAISettings} className={`${btnCls} mt-5`}>
          Save AI Settings
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[200] px-5 py-3 rounded-lg text-white font-medium shadow-lg ${toast.err ? 'bg-accent-red' : 'bg-accent-green'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
