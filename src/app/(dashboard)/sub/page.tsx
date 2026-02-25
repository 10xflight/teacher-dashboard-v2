'use client';

import { useState, useEffect, useCallback } from 'react';
import { localDateStr } from '@/lib/task-helpers';

// ── Types ──

interface ClassInfo {
  id: number;
  name: string;
  periods: string | null;
}

interface ScheduleEntry {
  period: string;
  time: string;
  class_id: number | null;
  class_name: string;
}

interface MediaItem {
  id: number;
  name: string;
  file_path: string | null;
  url: string | null;
  media_type: 'file' | 'link' | 'video';
  class_id: number | null;
  tags: string[];
  uploaded_at: string;
}

interface PlanSummary {
  id: number;
  date: string;
  share_token: string;
  status: string;
  mode: string;
  sub_name: string | null;
  created_at: string;
}

interface SubDashSnapshot {
  date: string;
  teacher_name: string;
  school_name: string;
  room_number: string;
  office_phone: string;
  schedule: ScheduleEntry[];
  periods: Array<{
    period: string;
    time: string;
    class_name: string;
    instructions: Array<{ title: string; description: string | null; activity_type: string }>;
  }>;
  bellringer: {
    display_url: string;
    prompts: Array<{ type: string; prompt: string }>;
  } | null;
  management_notes: string;
  behavior_policy: string;
  seating_chart_urls: string[];
  emergency_contacts: string;
  standing_instructions: string;
  backup_activities: string[];
  media: Array<{ name: string; file_path: string | null; url: string | null; media_type: string }>;
  custom_notes: string | null;
}

// ── Helpers ──

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

function getToday() {
  return localDateStr();
}

// ── Sub-components ──

function ClassroomProfileTab({ classes }: { classes: ClassInfo[] }) {
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [backupActivities, setBackupActivities] = useState<string[]>([]);
  const [seatingCharts, setSeatingCharts] = useState<string[]>([]);
  const [newActivity, setNewActivity] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sub/profile');
      const data = await res.json();
      setProfile(data);
      if (data.schedule_json) {
        try { setSchedule(JSON.parse(data.schedule_json)); } catch { /* ignore */ }
      }
      if (data.default_backup_activities) {
        try { setBackupActivities(JSON.parse(data.default_backup_activities)); } catch { /* ignore */ }
      }
      if (data.seating_chart_urls) {
        try { setSeatingCharts(JSON.parse(data.seating_chart_urls)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/sub/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          schedule_json: JSON.stringify(schedule),
          default_backup_activities: JSON.stringify(backupActivities),
        }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  }

  function addScheduleRow() {
    setSchedule([...schedule, { period: '', time: '', class_id: null, class_name: '' }]);
  }

  function updateScheduleRow(idx: number, field: string, value: string | number | null) {
    const updated = [...schedule];
    if (field === 'class_id') {
      const cls = classes.find(c => c.id === value);
      updated[idx] = { ...updated[idx], class_id: value as number | null, class_name: cls?.name || '' };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setSchedule(updated);
  }

  function removeScheduleRow(idx: number) {
    setSchedule(schedule.filter((_, i) => i !== idx));
  }

  function addBackupActivity() {
    if (!newActivity.trim()) return;
    setBackupActivities([...backupActivities, newActivity.trim()]);
    setNewActivity('');
  }

  async function uploadSeatingChart(file: File) {
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch('/api/sub/profile/seating-chart', { method: 'POST', body: form });
      const data = await res.json();
      if (data.urls) setSeatingCharts(data.urls);
    } catch { /* ignore */ }
  }

  async function removeSeatingChart(url: string) {
    try {
      const res = await fetch('/api/sub/profile/seating-chart', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.urls) setSeatingCharts(data.urls);
    } catch { /* ignore */ }
  }

  if (loading) return <div className="text-text-muted text-sm py-8 text-center">Loading profile...</div>;

  return (
    <div className="space-y-6">
      {/* Room Number */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Room Number</label>
        <input
          type="text"
          value={profile.room_number || ''}
          onChange={e => setProfile({ ...profile, room_number: e.target.value })}
          placeholder="e.g. 214"
          className="w-48 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none"
        />
      </div>

      {/* Office Phone */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Office Phone</label>
        <input
          type="text"
          value={profile.office_phone || ''}
          onChange={e => setProfile({ ...profile, office_phone: e.target.value })}
          placeholder="e.g. 405-555-1234"
          className="w-64 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none"
        />
      </div>

      {/* Schedule Builder */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Schedule</label>
        <div className="space-y-2">
          {schedule.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={row.period}
                onChange={e => updateScheduleRow(idx, 'period', e.target.value)}
                placeholder="Period"
                className="w-24 px-2 py-1.5 bg-bg-input border border-border rounded text-sm text-text-primary focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={row.time}
                onChange={e => updateScheduleRow(idx, 'time', e.target.value)}
                placeholder="Time (e.g. 8:00-8:50)"
                className="w-40 px-2 py-1.5 bg-bg-input border border-border rounded text-sm text-text-primary focus:border-accent focus:outline-none"
              />
              <select
                value={row.class_id ?? ''}
                onChange={e => updateScheduleRow(idx, 'class_id', e.target.value ? parseInt(e.target.value) : null)}
                className="w-48 px-2 py-1.5 bg-bg-input border border-border rounded text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="">— No class —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={() => removeScheduleRow(idx)} className="text-accent-red hover:text-red-400 text-sm">Remove</button>
            </div>
          ))}
        </div>
        <button onClick={addScheduleRow} className="mt-2 text-sm text-accent hover:underline">+ Add period</button>
      </div>

      {/* Management Notes */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Classroom Management Notes</label>
        <textarea
          value={profile.management_notes || ''}
          onChange={e => setProfile({ ...profile, management_notes: e.target.value })}
          rows={4}
          placeholder="Attendance procedures, hall pass rules, phone policy..."
          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none resize-y"
        />
      </div>

      {/* Behavior Policy */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Behavior Policy</label>
        <textarea
          value={profile.behavior_policy || ''}
          onChange={e => setProfile({ ...profile, behavior_policy: e.target.value })}
          rows={3}
          placeholder="Class rules, discipline process..."
          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none resize-y"
        />
      </div>

      {/* Seating Charts */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Seating Charts</label>
        <div className="flex flex-wrap gap-3 mb-2">
          {seatingCharts.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt={`Seating chart ${i + 1}`} className="w-32 h-32 object-cover rounded-lg border border-border" />
              <button
                onClick={() => removeSeatingChart(url)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                x
              </button>
            </div>
          ))}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) uploadSeatingChart(file);
            e.target.value = '';
          }}
          className="text-sm text-text-muted"
        />
      </div>

      {/* Emergency Contacts */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Emergency Contacts</label>
        <textarea
          value={profile.emergency_contacts || ''}
          onChange={e => setProfile({ ...profile, emergency_contacts: e.target.value })}
          rows={3}
          placeholder="Front office ext. 101, Nurse ext. 202..."
          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none resize-y"
        />
      </div>

      {/* Standing Instructions */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Standing Instructions</label>
        <textarea
          value={profile.standing_instructions || ''}
          onChange={e => setProfile({ ...profile, standing_instructions: e.target.value })}
          rows={3}
          placeholder="Instructions that apply every time you have a sub..."
          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none resize-y"
        />
      </div>

      {/* Backup Activities */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Default Backup Activities</label>
        <ul className="space-y-1 mb-2">
          {backupActivities.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="flex-1">{i + 1}. {a}</span>
              <button onClick={() => setBackupActivities(backupActivities.filter((_, j) => j !== i))} className="text-accent-red text-xs hover:underline">Remove</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={newActivity}
            onChange={e => setNewActivity(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBackupActivity(); } }}
            placeholder="Add a backup activity..."
            className="flex-1 px-3 py-1.5 bg-bg-input border border-border rounded text-sm text-text-primary focus:border-accent focus:outline-none"
          />
          <button onClick={addBackupActivity} className="px-3 py-1.5 bg-bg-secondary border border-border text-text-secondary rounded text-sm hover:border-accent">Add</button>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2 bg-accent text-bg-primary rounded-lg font-semibold hover:brightness-110 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}

function MediaLibraryTab({ classes }: { classes: ClassInfo[] }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<'file' | 'link' | 'video'>('file');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [classId, setClassId] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sub/media');
      const data = await res.json();
      if (Array.isArray(data)) setMedia(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('name', name || file.name);
    if (classId) form.append('class_id', classId);
    try {
      const res = await fetch('/api/sub/media', { method: 'POST', body: form });
      if (res.ok) {
        setName('');
        setClassId('');
        loadMedia();
      }
    } catch { /* ignore */ }
    setUploading(false);
  }

  async function addLinkOrVideo() {
    if (!name.trim() || !url.trim()) return;
    setUploading(true);
    try {
      const res = await fetch('/api/sub/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          media_type: addMode,
          class_id: classId ? parseInt(classId) : null,
          tags: [],
        }),
      });
      if (res.ok) {
        setName('');
        setUrl('');
        setClassId('');
        loadMedia();
      }
    } catch { /* ignore */ }
    setUploading(false);
  }

  async function deleteItem(id: number) {
    try {
      await fetch(`/api/sub/media/${id}`, { method: 'DELETE' });
      setMedia(media.filter(m => m.id !== id));
    } catch { /* ignore */ }
  }

  const typeIcon = (type: string) => {
    if (type === 'file') return '📄';
    if (type === 'video') return '🎬';
    return '🔗';
  };

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="rounded-lg bg-bg-secondary border border-border p-4 space-y-3">
        <div className="flex gap-2 mb-2">
          {(['file', 'link', 'video'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setAddMode(mode)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                addMode === mode ? 'bg-accent text-bg-primary' : 'bg-bg-input text-text-secondary hover:text-text-primary'
              }`}
            >
              {mode === 'file' ? 'Upload File' : mode === 'link' ? 'Add Link' : 'Add Video'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Resource name"
              className="w-48 px-2 py-1.5 bg-bg-input border border-border rounded text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </div>

          {addMode !== 'file' && (
            <div>
              <label className="block text-xs text-text-muted mb-1">URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={addMode === 'video' ? 'YouTube URL' : 'https://...'}
                className="w-64 px-2 py-1.5 bg-bg-input border border-border rounded text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-text-muted mb-1">Class (optional)</label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-40 px-2 py-1.5 bg-bg-input border border-border rounded text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="">— All —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {addMode === 'file' ? (
            <label className={`px-4 py-1.5 bg-accent text-bg-primary rounded text-sm font-semibold cursor-pointer hover:brightness-110 ${uploading ? 'opacity-50' : ''}`}>
              {uploading ? 'Uploading...' : 'Choose File'}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          ) : (
            <button
              onClick={addLinkOrVideo}
              disabled={uploading || !name.trim() || !url.trim()}
              className="px-4 py-1.5 bg-accent text-bg-primary rounded text-sm font-semibold hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
      </div>

      {/* Media grid */}
      {loading ? (
        <div className="text-text-muted text-sm text-center py-8">Loading media...</div>
      ) : media.length === 0 ? (
        <div className="text-text-muted text-sm text-center py-8">No media items yet. Add files, links, or videos above.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {media.map(item => (
            <div key={item.id} className="rounded-lg bg-bg-secondary border border-border p-3 flex items-start gap-3">
              <span className="text-2xl">{typeIcon(item.media_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                <p className="text-xs text-text-muted capitalize">{item.media_type}</p>
                {item.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {item.tags.map((t, i) => (
                      <span key={i} className="text-[10px] bg-accent/15 text-accent px-1.5 rounded">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => deleteItem(item.id)} className="text-accent-red text-xs hover:underline shrink-0">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GenerateTab({
  media,
  onGenerated,
}: {
  media: MediaItem[];
  onGenerated: () => void;
}) {
  const [date, setDate] = useState(getTomorrow());
  const [customNotes, setCustomNotes] = useState('');
  const [subName, setSubName] = useState('');
  const [subContact, setSubContact] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<number[]>([]);
  const [preview, setPreview] = useState<SubDashSnapshot | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{ share_url: string; share_token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadPreview() {
    setPreviewing(true);
    try {
      const res = await fetch('/api/sub/plans/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, custom_notes: customNotes || null, media_ids: selectedMedia }),
      });
      const data = await res.json();
      if (res.ok) setPreview(data);
    } catch { /* ignore */ }
    setPreviewing(false);
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/sub/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          custom_notes: customNotes || null,
          sub_name: subName || null,
          sub_contact: subContact || null,
          mode: 'planned',
          media_ids: selectedMedia,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Immediately share it
        await fetch(`/api/sub/plans/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'shared' }),
        });
        setResult({ share_url: data.share_url, share_token: data.share_token });
        onGenerated();
      }
    } catch { /* ignore */ }
    setGenerating(false);
  }

  function toggleMedia(id: number) {
    setSelectedMedia(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.share_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Result */}
      {result && (
        <div className="rounded-xl bg-accent/10 border border-accent/30 p-5 space-y-3">
          <h3 className="text-lg font-bold text-accent">SubDash Ready!</h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              value={result.share_url}
              className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary"
            />
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.share_url)}`}
              alt="QR Code"
              className="w-48 h-48 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); setPreview(null); }}
            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Sub Name</label>
          <input
            type="text"
            value={subName}
            onChange={e => setSubName(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">Sub Contact</label>
          <input
            type="text"
            value={subContact}
            onChange={e => setSubContact(e.target.value)}
            placeholder="Phone or email (optional)"
            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">Custom Notes for Sub</label>
          <textarea
            value={customNotes}
            onChange={e => setCustomNotes(e.target.value)}
            rows={3}
            placeholder="Any special instructions for this specific day..."
            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none resize-y"
          />
        </div>
      </div>

      {/* Media selection */}
      {media.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Attach Media</label>
          <div className="space-y-1">
            {media.map(item => (
              <label key={item.id} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={selectedMedia.includes(item.id)}
                  onChange={() => toggleMedia(item.id)}
                  className="rounded border-border"
                />
                <span>{item.media_type === 'file' ? '📄' : item.media_type === 'video' ? '🎬' : '🔗'}</span>
                {item.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={loadPreview}
          disabled={previewing}
          className="px-5 py-2 bg-bg-secondary border border-border text-text-secondary rounded-lg font-semibold text-sm hover:border-accent transition-colors disabled:opacity-50"
        >
          {previewing ? 'Loading...' : 'Preview'}
        </button>
        <button
          onClick={generate}
          disabled={generating}
          className="px-5 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110 disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate & Share'}
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="rounded-lg bg-bg-secondary border border-border p-4 space-y-3">
          <h4 className="text-sm font-bold text-text-primary">Preview for {formatDate(preview.date)}</h4>
          {preview.schedule.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted mb-1">Schedule:</p>
              {preview.schedule.map((s, i) => (
                <p key={i} className="text-xs text-text-secondary">{s.period} | {s.time} | {s.class_name || '—'}</p>
              ))}
            </div>
          )}
          {preview.periods.filter(p => p.instructions.length > 0).map((period, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-text-muted">{period.period}: {period.class_name}</p>
              {period.instructions.map((inst, j) => (
                <p key={j} className="text-xs text-text-secondary ml-3">• {inst.title}</p>
              ))}
            </div>
          ))}
          {preview.bellringer && (
            <div>
              <p className="text-xs font-semibold text-text-muted">Bellringer: {preview.bellringer.prompts.length} prompt(s)</p>
            </div>
          )}
          {preview.media.length > 0 && (
            <p className="text-xs text-text-muted">{preview.media.length} media item(s) attached</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function SubDashPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'media' | 'generate'>('profile');
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState<{ share_url: string } | null>(null);
  const [copied, setCopied] = useState('');

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch('/api/sub/plans');
      const data = await res.json();
      if (Array.isArray(data)) setPlans(data);
    } catch { /* ignore */ }
    setLoadingPlans(false);
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes');
      const data = await res.json();
      if (Array.isArray(data)) setClasses(data);
    } catch { /* ignore */ }
  }, []);

  const loadMedia = useCallback(async () => {
    try {
      const res = await fetch('/api/sub/media');
      const data = await res.json();
      if (Array.isArray(data)) setMedia(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadPlans();
    loadClasses();
    loadMedia();
  }, [loadPlans, loadClasses, loadMedia]);

  async function handleEmergency() {
    if (!confirm('Create an Emergency SubDash for TODAY? This will be immediately shareable.')) return;
    setEmergencyLoading(true);
    try {
      const res = await fetch('/api/sub/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: getToday(), mode: 'emergency', media_ids: [] }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmergencyResult({ share_url: data.share_url });
        loadPlans();
      }
    } catch { /* ignore */ }
    setEmergencyLoading(false);
  }

  async function deletePlan(id: number) {
    try {
      await fetch(`/api/sub/plans/${id}`, { method: 'DELETE' });
      setPlans(plans.filter(p => p.id !== id));
    } catch { /* ignore */ }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  const tabs = [
    { key: 'profile' as const, label: 'Classroom Profile' },
    { key: 'media' as const, label: 'Media Library' },
    { key: 'generate' as const, label: 'Generate' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">SubDash</h1>
        <p className="text-sm text-text-muted mt-1">
          Build your classroom profile, manage resources, and generate shareable substitute dashboards
        </p>
      </div>

      {/* Emergency Button */}
      <button
        onClick={handleEmergency}
        disabled={emergencyLoading}
        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base transition-colors disabled:opacity-50"
      >
        {emergencyLoading ? 'Creating...' : "I'm Sick — Emergency SubDash for Today"}
      </button>

      {/* Emergency result */}
      {emergencyResult && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-3">
          <h3 className="text-base font-bold text-red-400">Emergency SubDash Ready!</h3>
          <div className="flex items-center gap-3">
            <input type="text" readOnly value={emergencyResult.share_url} className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary" />
            <button
              onClick={() => copyToClipboard(emergencyResult.share_url, 'emergency')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700"
            >
              {copied === 'emergency' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(emergencyResult.share_url)}`}
              alt="QR Code"
              className="w-48 h-48 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-bg-secondary p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-bg-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        {activeTab === 'profile' && <ClassroomProfileTab classes={classes} />}
        {activeTab === 'media' && <MediaLibraryTab classes={classes} />}
        {activeTab === 'generate' && <GenerateTab media={media} onGenerated={loadPlans} />}
      </div>

      {/* History */}
      <div>
        <h2 className="text-lg font-bold text-text-primary mb-3">SubDash History</h2>
        {loadingPlans ? (
          <p className="text-sm text-text-muted">Loading...</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-text-muted">No SubDash plans yet.</p>
        ) : (
          <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Mode</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Sub</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => {
                  const planUrl = `${window.location.origin}/subdash/${plan.share_token}`;
                  return (
                    <tr key={plan.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2 text-text-primary">{formatDate(plan.date)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          plan.mode === 'emergency'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-accent/15 text-accent'
                        }`}>
                          {plan.mode}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          plan.status === 'shared'
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-text-muted">{plan.sub_name || '—'}</td>
                      <td className="px-4 py-2 text-right space-x-2">
                        {plan.status === 'shared' && (
                          <>
                            <a href={planUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs">Open</a>
                            <button
                              onClick={() => copyToClipboard(planUrl, `plan-${plan.id}`)}
                              className="text-accent hover:underline text-xs"
                            >
                              {copied === `plan-${plan.id}` ? 'Copied!' : 'Copy'}
                            </button>
                          </>
                        )}
                        <button onClick={() => deletePlan(plan.id)} className="text-accent-red hover:underline text-xs">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
