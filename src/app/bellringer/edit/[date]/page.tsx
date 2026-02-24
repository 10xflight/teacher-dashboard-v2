'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const JOURNAL_TYPE_OPTIONS = [
  { value: 'creative', label: 'Creative' },
  { value: 'quote', label: 'Quote' },
  { value: 'image', label: 'Image / Visual' },
  { value: 'emoji', label: 'Emoji' },
  { value: 'reflective', label: 'Reflective' },
  { value: 'critical_thinking', label: 'Thought-Provoking' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'poetry', label: 'Poetry / Poem' },
  { value: 'list', label: 'Top 5 List' },
  { value: 'debate', label: 'Debate / Devil\'s Advocate' },
  { value: 'would_you_rather', label: 'Would You Rather' },
];

interface PromptSlot {
  journal_type: string;
  journal_prompt: string;
  journal_subprompt: string;
  image_path: string | null;
}

interface ACTFields {
  act_skill: string;
  act_question: string;
  act_choices: string;
  act_correct_answer: string;
  act_rule: string;
}

function Toast({ message, isError, onDone }: { message: string; isError?: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`fixed bottom-4 right-4 z-[200] px-5 py-3 rounded-lg text-white font-medium shadow-lg transition-all animate-[slideIn_0.3s_ease]
      ${isError ? 'bg-[#e74c3c]' : 'bg-[#4ECDC4] text-[#1a1a2e]'}`}>
      {message}
    </div>
  );
}

export default function BellringerEditPage() {
  const params = useParams();
  const dateStr = params.date === 'today'
    ? new Date().toISOString().split('T')[0]
    : String(params.date);

  const [prompts, setPrompts] = useState<PromptSlot[]>([
    { journal_type: 'creative', journal_prompt: '', journal_subprompt: 'WRITE A PARAGRAPH IN YOUR JOURNAL!', image_path: null },
    { journal_type: 'quote', journal_prompt: '', journal_subprompt: 'WRITE A PARAGRAPH IN YOUR JOURNAL!', image_path: null },
    { journal_type: 'emoji', journal_prompt: '', journal_subprompt: 'WRITE A PARAGRAPH IN YOUR JOURNAL!', image_path: null },
    { journal_type: 'reflective', journal_prompt: '', journal_subprompt: 'WRITE A PARAGRAPH IN YOUR JOURNAL!', image_path: null },
  ]);
  const [subprompt, setSubprompt] = useState('WRITE A PARAGRAPH IN YOUR JOURNAL!');
  const [act, setAct] = useState<ACTFields>({
    act_skill: '', act_question: '', act_choices: '', act_correct_answer: 'A', act_rule: '',
  });
  const [teacherNotes, setTeacherNotes] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const loaded = useRef(false);

  const showToast = useCallback((message: string, isError?: boolean) => {
    setToast({ message, isError });
  }, []);

  // Mark dirty on any user change (but not on initial load)
  function markDirty() {
    if (loaded.current) setDirty(true);
  }

  // Load existing bellringer
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bellringers/${dateStr}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;
        const b = data.bellringer;

        if (data.prompts?.length > 0) {
          const slots: PromptSlot[] = [0, 1, 2, 3].map(i => {
            const p = data.prompts.find((pr: { slot: number }) => pr.slot === i);
            return {
              journal_type: p?.journal_type || 'creative',
              journal_prompt: p?.journal_prompt || '',
              journal_subprompt: p?.journal_subprompt || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
              image_path: p?.image_path || null,
            };
          });
          setPrompts(slots);
          if (data.prompts[0]?.journal_subprompt) {
            setSubprompt(data.prompts[0].journal_subprompt);
          }
        }

        if (b) {
          const choices = [b.act_choice_a, b.act_choice_b, b.act_choice_c, b.act_choice_d]
            .filter(Boolean).join('\n');
          setAct({
            act_skill: b.act_skill || '',
            act_question: b.act_question || '',
            act_choices: choices,
            act_correct_answer: b.act_correct_answer || 'A',
            act_rule: b.act_rule || '',
          });
        }
      } catch {
        // No existing bellringer
      }
      // Allow dirty tracking after load completes
      setTimeout(() => { loaded.current = true; }, 100);
    }
    load();
  }, [dateStr]);

  function updatePrompt(slot: number, field: keyof PromptSlot, value: string) {
    markDirty();
    setPrompts(prev => {
      const next = [...prev];
      next[slot] = { ...next[slot], [field]: value };
      return next;
    });
  }

  function wrapSelection(slotIdx: number, openTag: string, closeTag: string) {
    const ta = textareaRefs.current[slotIdx];
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);
    if (!selected) return;
    const newVal = text.substring(0, start) + openTag + selected + closeTag + text.substring(end);
    updatePrompt(slotIdx, 'journal_prompt', newVal);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + openTag.length;
      ta.selectionEnd = end + openTag.length;
    }, 0);
  }

  function wrapActSelection(openTag: string, closeTag: string) {
    const ta = document.getElementById('act-question') as HTMLTextAreaElement;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);
    if (!selected) return;
    markDirty();
    setAct(prev => ({
      ...prev,
      act_question: text.substring(0, start) + openTag + selected + closeTag + text.substring(end),
    }));
  }

  function getPromptPayloads() {
    return prompts.map((p, i) => ({
      slot: i,
      journal_type: p.journal_type,
      journal_prompt: p.journal_prompt,
      journal_subprompt: subprompt,
    }));
  }

  function getACTPayload() {
    const lines = act.act_choices.split('\n').map(l => l.trim()).filter(Boolean);
    return {
      act_skill: act.act_skill,
      act_question: act.act_question,
      act_choice_a: lines[0] || '',
      act_choice_b: lines[1] || '',
      act_choice_c: lines[2] || '',
      act_choice_d: lines[3] || '',
      act_correct_answer: act.act_correct_answer,
      act_explanation: '',
      act_rule: act.act_rule,
    };
  }

  async function saveBellringer() {
    setSaving(true);
    try {
      const saveRes = await fetch('/api/bellringers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, prompts: getPromptPayloads(), ...getACTPayload() }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        showToast(err.error || `Save failed (${saveRes.status})`, true);
        return false;
      }

      const approveRes = await fetch('/api/bellringers/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      if (!approveRes.ok) {
        const err = await approveRes.json().catch(() => ({}));
        showToast(err.error || `Approve failed (${approveRes.status})`, true);
        return false;
      }

      setDirty(false);
      showToast('Saved!');
      return true;
    } catch {
      showToast('Failed to save — check your connection', true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndDisplay() {
    const ok = await saveBellringer();
    if (ok) {
      window.open(`/display/${dateStr}?t=${Date.now()}`, 'tv-display');
    }
  }

  async function generateAll() {
    setGenerating('all');
    try {
      const res = await fetch('/api/bellringers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, notes: teacherNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.prompts) {
          const slots: PromptSlot[] = [0, 1, 2, 3].map(i => {
            const p = data.prompts.find((pr: { slot: number }) => pr.slot === i);
            return {
              journal_type: p?.journal_type || prompts[i].journal_type,
              journal_prompt: p?.journal_prompt || prompts[i].journal_prompt,
              journal_subprompt: p?.journal_subprompt || subprompt,
              image_path: prompts[i].image_path,
            };
          });
          setPrompts(slots);
        }
        const b = data.bellringer;
        if (b) {
          const choices = [b.act_choice_a, b.act_choice_b, b.act_choice_c, b.act_choice_d]
            .filter(Boolean).join('\n');
          setAct({
            act_skill: b.act_skill || '',
            act_question: b.act_question || '',
            act_choices: choices,
            act_correct_answer: b.act_correct_answer || 'A',
            act_rule: b.act_rule || '',
          });
        }
        setDirty(false);
        showToast('Generated & saved!');
      } else {
        showToast(data.error || 'Generation failed', true);
      }
    } catch {
      showToast('Failed to generate', true);
    } finally {
      setGenerating(null);
    }
  }

  async function regenSlot(slot: number) {
    setGenerating(`slot-${slot}`);
    try {
      const res = await fetch('/api/bellringers/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          slot,
          prompt_type: prompts[slot].journal_type,
          notes: teacherNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const p = data.prompt;
        updatePrompt(slot, 'journal_type', p?.journal_type || prompts[slot].journal_type);
        updatePrompt(slot, 'journal_prompt', p?.journal_prompt || '');
        showToast(`Prompt ${slot + 1} regenerated!`);
      } else {
        showToast(data.error || 'Failed', true);
      }
    } catch {
      showToast('Failed to regenerate', true);
    } finally {
      setGenerating(null);
    }
  }

  async function regenACT() {
    setGenerating('act');
    try {
      const res = await fetch('/api/bellringers/generate-act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, notes: teacherNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        const b = data.bellringer;
        const choices = [b.act_choice_a, b.act_choice_b, b.act_choice_c, b.act_choice_d]
          .filter(Boolean).join('\n');
        setAct({
          act_skill: b.act_skill || '',
          act_question: b.act_question || '',
          act_choices: choices,
          act_correct_answer: b.act_correct_answer || 'A',
          act_rule: b.act_rule || '',
        });
        showToast('ACT regenerated!');
      } else {
        showToast(data.error || 'Failed', true);
      }
    } catch {
      showToast('Failed to regenerate ACT', true);
    } finally {
      setGenerating(null);
    }
  }

  async function uploadSlotImage(slot: number, file: File) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('date', dateStr);
    formData.append('slot', String(slot));
    try {
      const res = await fetch('/api/bellringers/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setPrompts(prev => {
          const next = [...prev];
          next[slot] = { ...next[slot], image_path: data.path };
          return next;
        });
        showToast('Image uploaded!');
      } else {
        showToast(data.error || 'Upload failed', true);
      }
    } catch {
      showToast('Failed to upload image', true);
    }
  }

  async function removeImage(slot: number) {
    try {
      const res = await fetch('/api/bellringers/remove-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, slot }),
      });
      if (res.ok) {
        setPrompts(prev => {
          const next = [...prev];
          next[slot] = { ...next[slot], image_path: null };
          return next;
        });
        showToast('Image removed');
      }
    } catch {
      showToast('Failed to remove image', true);
    }
  }

  function clearAll() {
    if (!confirm('Clear all fields?')) return;
    setPrompts([0, 1, 2, 3].map(() => ({
      journal_type: 'creative',
      journal_prompt: '',
      journal_subprompt: 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
      image_path: null,
    })));
    setSubprompt('WRITE A PARAGRAPH IN YOUR JOURNAL!');
    setAct({ act_skill: '', act_question: '', act_choices: '', act_correct_answer: 'A', act_rule: '' });
    setTeacherNotes('');
    setDirty(true);
    showToast('Cleared');
  }

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const inputCls = 'w-full px-3.5 py-2.5 bg-[#253352] border border-[#2d3f5f] rounded-lg text-white text-sm font-[inherit] focus:border-[#4ECDC4] focus:outline-none';
  const btn = 'px-4 py-2 bg-[#4ECDC4] text-[#1a1a2e] rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50';
  const btnSmall = 'px-2.5 py-1.5 text-xs bg-[#4ECDC4] text-[#1a1a2e] rounded-lg font-semibold hover:brightness-110 transition-all disabled:opacity-50';
  const btnMuted = 'px-4 py-2 bg-[#2a3a5c] text-[#a8b2d1] rounded-lg font-semibold text-sm hover:bg-[#344868] transition-all';
  const btnMutedSmall = 'px-2.5 py-1.5 text-xs bg-[#2a3a5c] text-[#a8b2d1] rounded-lg font-semibold hover:bg-[#344868] transition-all';

  return (
    <div className="min-h-screen" style={{ background: '#1a1a2e' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-[#2d3f5f]"
        style={{ background: '#16213e' }}>
        <h1 className="text-xl font-bold tracking-wide text-white">
          BELLRINGER &mdash; {dateStr}
          {dirty && <span className="ml-2 text-xs font-normal text-[#a8b2d1]">(unsaved)</span>}
        </h1>
        <div className="flex gap-2">
          <button className={btn} onClick={saveBellringer} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
            {saving && <Spinner />}
          </button>
          <button className={btn} onClick={saveAndDisplay} disabled={saving}>
            Display on TV
          </button>
          <button className={btnMuted} onClick={clearAll}>Clear All</button>
          <Link href="/bellringer/batch" className={btnMuted}>Batch Generate</Link>
          <Link href="/bellringer/library" className={btnMuted}>Library</Link>
          <Link href="/" className={btnMuted}>Dashboard</Link>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-6 py-5">
        {/* Teacher Notes / Idea Box */}
        <div className="rounded-lg p-4 border border-[#4ECDC4]" style={{ background: '#1f2b47' }}>
          <div className="text-xs uppercase tracking-widest text-[#4ECDC4] font-semibold mb-3">
            Your Idea / Theme (optional)
          </div>
          <textarea
            value={teacherNotes}
            onChange={e => setTeacherNotes(e.target.value)}
            placeholder="Type anything here - a theme, a topic, a random thought... AI will use it to shape the prompts."
            className={`${inputCls} min-h-[60px] resize-y`}
          />
          <div className="flex gap-2 mt-2 items-center">
            <button className={btn} onClick={generateAll} disabled={generating !== null}>
              {generating === 'all' ? 'Generating...' : 'Generate All from Idea'}
              {generating === 'all' && <Spinner />}
            </button>
            <span className="text-xs text-[#6c7a96]">or generate individually below</span>
          </div>
        </div>

        <hr className="border-[#2d3f5f] my-6" />

        {/* Journal Prompts 2x2 Grid */}
        <div className="text-xs uppercase tracking-widest text-[#4ECDC4] font-semibold mb-3">
          Journal Prompts (Choose 1 for display)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {prompts.map((p, i) => (
            <div key={i} className="rounded-lg p-4 border border-[#2d3f5f]" style={{ background: '#16213e' }}>
              <div className="text-[0.7rem] uppercase tracking-wider text-[#6c7a96] mb-2">
                Prompt {i + 1}
              </div>
              <select
                value={p.journal_type}
                onChange={e => updatePrompt(i, 'journal_type', e.target.value)}
                className={`${inputCls} mb-2`}
              >
                {JOURNAL_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="flex gap-1 mb-1">
                <button className="px-2 py-0.5 text-xs bg-[#253352] border border-[#2d3f5f] rounded text-white font-serif hover:border-[#4ECDC4]"
                  onClick={() => wrapSelection(i, '<b>', '</b>')} title="Bold"><b>B</b></button>
                <button className="px-2 py-0.5 text-xs bg-[#253352] border border-[#2d3f5f] rounded text-white font-serif hover:border-[#4ECDC4]"
                  onClick={() => wrapSelection(i, '<i>', '</i>')} title="Italic"><i>I</i></button>
              </div>
              <textarea
                ref={el => { textareaRefs.current[i] = el; }}
                value={p.journal_prompt}
                onChange={e => updatePrompt(i, 'journal_prompt', e.target.value)}
                placeholder="Journal prompt text..."
                className={`${inputCls} min-h-[80px] resize-y mb-2`}
              />

              {/* Image zone */}
              <div
                className="border border-dashed border-[#2d3f5f] rounded-md p-2.5 text-center cursor-pointer text-xs text-[#6c7a96] hover:border-[#4ECDC4] transition-colors mb-2"
                onClick={() => document.getElementById(`img-input-${i}`)?.click()}
              >
                <input
                  id={`img-input-${i}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadSlotImage(i, e.target.files[0]); }}
                />
                {p.image_path ? (
                  <>
                    <img src={p.image_path} alt="" className="max-w-full max-h-[100px] rounded mx-auto mt-1" />
                    <span>Click to change image</span>
                  </>
                ) : (
                  <span>Click to upload image</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  className={btnSmall}
                  onClick={() => regenSlot(i)}
                  disabled={generating !== null}
                >
                  {generating === `slot-${i}` ? 'Generating...' : 'Regenerate'}
                  {generating === `slot-${i}` && <Spinner />}
                </button>
                {p.image_path && (
                  <button className={btnMutedSmall} onClick={() => removeImage(i)}>Remove Image</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <hr className="border-[#2d3f5f] my-6" />

        {/* ACT Prep Section */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs uppercase tracking-widest text-[#4ECDC4] font-semibold">ACT Prep Question</span>
          <button
            className={btnSmall}
            onClick={regenACT}
            disabled={generating !== null}
          >
            {generating === 'act' ? 'Generating...' : 'Regenerate ACT'}
            {generating === 'act' && <Spinner />}
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-[#4ECDC4] font-semibold mb-1">
            Skill (e.g. Comma Rules, Apostrophes, Vocab in Context)
          </label>
          <input
            type="text"
            value={act.act_skill}
            onChange={e => { setAct(prev => ({ ...prev, act_skill: e.target.value })); markDirty(); }}
            className={inputCls}
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-[#4ECDC4] font-semibold mb-1">Question</label>
          <div className="flex gap-1 mb-1">
            <button className="px-2 py-0.5 text-xs bg-[#253352] border border-[#2d3f5f] rounded text-white font-serif hover:border-[#4ECDC4]"
              onClick={() => wrapActSelection('<b>', '</b>')} title="Bold"><b>B</b></button>
            <button className="px-2 py-0.5 text-xs bg-[#253352] border border-[#2d3f5f] rounded text-white font-serif hover:border-[#4ECDC4]"
              onClick={() => wrapActSelection('<i>', '</i>')} title="Italic"><i>I</i></button>
          </div>
          <textarea
            id="act-question"
            value={act.act_question}
            onChange={e => { setAct(prev => ({ ...prev, act_question: e.target.value })); markDirty(); }}
            className={`${inputCls} min-h-[60px] resize-y`}
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-[#4ECDC4] font-semibold mb-1">
            Answer Choices (one per line: A. ... B. ... C. ... D. ...)
          </label>
          <textarea
            value={act.act_choices}
            onChange={e => { setAct(prev => ({ ...prev, act_choices: e.target.value })); markDirty(); }}
            className={`${inputCls} min-h-[90px] resize-y`}
          />
        </div>

        <div className="flex gap-4 mb-6">
          <div className="w-[120px]">
            <label className="block text-xs uppercase tracking-wider text-[#4ECDC4] font-semibold mb-1">Answer</label>
            <select
              value={act.act_correct_answer}
              onChange={e => { setAct(prev => ({ ...prev, act_correct_answer: e.target.value })); markDirty(); }}
              className={inputCls}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-wider text-[#4ECDC4] font-semibold mb-1">
              Rule (shown in yellow on TV)
            </label>
            <input
              type="text"
              value={act.act_rule}
              onChange={e => { setAct(prev => ({ ...prev, act_rule: e.target.value })); markDirty(); }}
              className={inputCls}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2.5 flex-wrap pt-5 border-t border-[#2d3f5f]">
          <button className={`${btn} px-6 py-2.5`} onClick={saveBellringer} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
            {saving && <Spinner />}
          </button>
          <button className={`${btn} px-6 py-2.5`} onClick={saveAndDisplay} disabled={saving}>
            Save & Display on TV
          </button>
          <button className={`${btn} px-6 py-2.5`} onClick={generateAll} disabled={generating !== null}>
            {generating === 'all' ? 'Generating...' : 'Generate All'}
            {generating === 'all' && <Spinner />}
          </button>
          <button className={`${btnMuted} px-6 py-2.5`} onClick={clearAll}>Clear All</button>
        </div>
      </main>

      {/* Toast */}
      {toast && <Toast message={toast.message} isError={toast.isError} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-[#2d3f5f] border-t-[#4ECDC4] rounded-full animate-spin ml-1 align-middle" />
  );
}
