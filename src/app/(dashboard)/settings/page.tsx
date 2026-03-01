'use client';

import { useEffect, useState } from 'react';
import { SettingsSkeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

interface ClassInfo {
  id: number;
  name: string;
  periods: string | null;
  color: string | null;
}

type AIProvider = 'gemini' | 'anthropic';

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
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
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [anthropicModel, setAnthropicModel] = useState('claude-sonnet-4-20250514');
  const [schoolName, setSchoolName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [gradingPeriodEnd, setGradingPeriodEnd] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [fontSize, setFontSize] = useState('normal');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [seedingCalendar, setSeedingCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Env var status indicators (from server)
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});

  // Email integration state
  const [msUserEmail, setMsUserEmail] = useState('');
  const [msEmailEnabled, setMsEmailEnabled] = useState(false);
  const [msLastFetch, setMsLastFetch] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);


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
        const validGeminiModels = GEMINI_MODELS.map(m => m.value);
        const loadedGeminiModel = settings.gemini_model || 'gemini-2.5-flash';
        setGeminiModel(validGeminiModels.includes(loadedGeminiModel) ? loadedGeminiModel : 'gemini-2.5-flash');
        setAnthropicModel(settings.anthropic_model || 'claude-sonnet-4-20250514');
        setSchoolName(settings.school_name || '');
        setTeacherName(settings.teacher_name || '');
        setSchoolYear(settings.school_year || '');
        setPeriodsPerDay(parseInt(settings.periods_per_day) || 7);
        setGradingPeriodEnd(settings.grading_period_end || '');
        setSemesterEnd(settings.semester_end || '');
        setFontSize(settings.app_font_size || 'normal');
        setClasses(cls || []);

        // Env var status
        setEnvStatus({
          gemini: settings._env_gemini === 'configured',
          anthropic: settings._env_anthropic === 'configured',
          ms_client_id: settings._env_ms_client_id === 'configured',
          ms_client_secret: settings._env_ms_client_secret === 'configured',
          ms_tenant_id: settings._env_ms_tenant_id === 'configured',
          resend: settings._env_resend === 'configured',
        });

        // Email integration settings
        setMsUserEmail(settings.ms_user_email || '');
        setMsEmailEnabled(settings.ms_email_enabled === 'true');
        setMsLastFetch(settings.ms_last_fetch || '');
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  // Handle OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam === 'connected') {
      showToast('Microsoft 365 email connected!');
      setMsEmailEnabled(true);
      // Re-fetch settings to get the email address
      fetch('/api/settings').then(r => r.json()).then(settings => {
        setMsUserEmail(settings.ms_user_email || '');
      }).catch(() => {});
      // Clean up the URL
      window.history.replaceState({}, '', '/settings');
    } else if (emailParam === 'error') {
      const msg = params.get('msg') || 'Connection failed';
      showToast(msg, true);
      window.history.replaceState({}, '', '/settings');
    }
  }, [showToast]);

  async function saveSchoolInfo() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_name: schoolName,
        teacher_name: teacherName,
        school_year: schoolYear,
        periods_per_day: String(periodsPerDay),
        grading_period_end: gradingPeriodEnd,
        semester_end: semesterEnd,
      }),
    });
    showToast('School info saved!');
  }

  async function saveFontSize(size: string) {
    setFontSize(size);
    // Apply immediately
    const html = document.documentElement;
    html.classList.remove('font-size-large', 'font-size-xl');
    if (size === 'large') html.classList.add('font-size-large');
    else if (size === 'xl') html.classList.add('font-size-xl');
    localStorage.setItem('app_font_size', size);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_font_size: size }),
    });
    showToast('Font size updated!');
  }

  async function saveAISettings() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ai_provider: provider,
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

  function connectEmail() {
    window.location.href = '/api/email/connect';
  }

  async function disconnectEmail() {
    setDisconnecting(true);
    try {
      await fetch('/api/email/disconnect', { method: 'POST' });
      setMsEmailEnabled(false);
      setMsUserEmail('');
      setMsLastFetch('');
      showToast('Email disconnected.');
    } catch {
      showToast('Failed to disconnect', true);
    }
    setDisconnecting(false);
  }

  async function checkEmailNow() {
    setCheckingEmail(true);
    try {
      const res = await fetch('/api/email/fetch', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMsLastFetch(new Date().toISOString());
        showToast(`Checked ${data.fetched} emails, extracted ${data.extracted} tasks`);
      } else {
        showToast(data.error || 'Failed to check email', true);
      }
    } catch {
      showToast('Failed to check email', true);
    }
    setCheckingEmail(false);
  }

  const inputCls = 'w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none';
  const labelCls = 'block text-xs uppercase tracking-wider text-accent font-semibold mb-1';
  const btnCls = 'px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110';

  const periodNumbers = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <SettingsSkeleton />
      </div>
    );
  }

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={labelCls}>Periods Per Day</label>
            <select
              value={periodsPerDay}
              onChange={e => setPeriodsPerDay(parseInt(e.target.value))}
              className={inputCls}
            >
              {[4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n} periods</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Grading Period Ends</label>
            <input type="date" value={gradingPeriodEnd} onChange={e => setGradingPeriodEnd(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Semester Ends</label>
            <input type="date" value={semesterEnd} onChange={e => setSemesterEnd(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button onClick={saveSchoolInfo} className={btnCls}>
          Save Info
        </button>
      </div>

      {/* Display */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Display</h2>
        <div>
          <label className={labelCls}>Font Size</label>
          <div className="flex gap-2">
            {[
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
              { value: 'xl', label: 'Extra Large' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => saveFontSize(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  fontSize === opt.value
                    ? 'bg-accent text-bg-primary border-accent'
                    : 'bg-bg-input text-text-secondary border-border hover:border-accent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
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
          {classes.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-6">
              <svg className="w-6 h-6 text-text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
              <p className="text-sm text-text-muted">No classes yet</p>
              <p className="text-xs text-text-muted/70">Click &quot;+ Add Class&quot; above to get started.</p>
            </div>
          )}
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
            <div className="flex items-center gap-2 mt-1">
              {envStatus.gemini ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-green/10 text-accent-green text-xs font-medium border border-accent-green/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                  Configured in .env.local
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-red/10 text-accent-red text-xs font-medium border border-accent-red/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                  Not set — add GEMINI_API_KEY to .env.local
                </span>
              )}
            </div>
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
            <div className="flex items-center gap-2 mt-1">
              {envStatus.anthropic ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-green/10 text-accent-green text-xs font-medium border border-accent-green/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                  Configured in .env.local
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-red/10 text-accent-red text-xs font-medium border border-accent-red/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                  Not set — add ANTHROPIC_API_KEY to .env.local
                </span>
              )}
            </div>
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

      {/* Email Integration */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Email Integration</h2>
        <p className="text-sm text-text-secondary mb-4">
          Connect your school Microsoft 365 email to auto-extract tasks from incoming emails.
        </p>

        {msEmailEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-green/10 border border-accent-green/30">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-green shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Connected</p>
                <p className="text-xs text-text-muted truncate">{msUserEmail}</p>
              </div>
              <button
                onClick={disconnectEmail}
                disabled={disconnecting}
                className="px-3 py-1.5 text-xs text-accent-red border border-accent-red/30 rounded-lg hover:bg-accent-red/10 transition-colors"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-muted">
                  Last checked: {msLastFetch
                    ? new Date(msLastFetch).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <button
                onClick={checkEmailNow}
                disabled={checkingEmail}
                className={btnCls}
              >
                {checkingEmail ? 'Checking...' : 'Check Now'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className={labelCls}>Azure Credentials (from .env.local)</label>
              <div className="flex flex-wrap gap-2">
                {(['ms_client_id', 'ms_client_secret', 'ms_tenant_id'] as const).map(key => (
                  <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                    envStatus[key]
                      ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                      : 'bg-accent-red/10 text-accent-red border-accent-red/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${envStatus[key] ? 'bg-accent-green' : 'bg-accent-red'}`} />
                    {key.replace('ms_', '').replace('_', ' ').toUpperCase()}: {envStatus[key] ? 'Set' : 'Missing'}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Set MS_CLIENT_ID, MS_CLIENT_SECRET, and MS_TENANT_ID in .env.local.
              Register an app in Azure Portal &gt; Azure AD &gt; App registrations with Mail.Read, offline_access, and User.Read permissions.
            </p>
            <button
              onClick={connectEmail}
              disabled={!envStatus.ms_client_id || !envStatus.ms_tenant_id}
              className={`${btnCls} ${!envStatus.ms_client_id || !envStatus.ms_tenant_id ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Connect Microsoft 365
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
