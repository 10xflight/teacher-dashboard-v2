'use client';

import { inputCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditSentenceDressup({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateSentence = (i: number, field: string, value: string) => {
    const sentences = [...(material.sentences || [])];
    sentences[i] = { ...sentences[i], [field]: value };
    onChange({ ...material, sentences });
  };
  const addSentence = () => {
    onChange({ ...material, sentences: [...(material.sentences || []), { base: '', technique: '', example: '' }] });
  };
  const removeSentence = (i: number) => {
    onChange({ ...material, sentences: (material.sentences || []).filter((_: any, idx: number) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <input value={material.instructions || ''} onChange={e => onChange({ ...material, instructions: e.target.value })} placeholder="Instructions (optional)" className={inputCls} />
      {(material.sentences || []).map((s: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1.5 border border-border/50">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-text-muted mt-1.5 shrink-0 w-5">{i + 1}.</span>
            <div className="flex-1 space-y-1.5">
              <input value={s.base || ''} onChange={e => updateSentence(i, 'base', e.target.value)} className={inputCls} placeholder="Base sentence" />
              <input value={s.technique || ''} onChange={e => updateSentence(i, 'technique', e.target.value)} className={inputCls + ' text-accent'} placeholder="Technique to apply" />
              <input value={s.example || ''} onChange={e => updateSentence(i, 'example', e.target.value)} className={inputCls + ' text-accent-green'} placeholder="Example with technique applied" />
            </div>
            <button onClick={() => removeSentence(i)} className="text-accent-red text-xs font-bold shrink-0 mt-1">&times;</button>
          </div>
        </div>
      ))}
      <button onClick={addSentence} className="text-xs text-accent hover:underline">+ Add Sentence</button>
    </div>
  );
}
