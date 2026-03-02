'use client';

import { inputCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditConjugationDrill({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateVerb = (vi: number, field: string, value: any) => {
    const verbs = [...(material.verbs || [])];
    verbs[vi] = { ...verbs[vi], [field]: value };
    onChange({ ...material, verbs });
  };
  const updateConj = (vi: number, pronoun: string, form: string) => {
    const verbs = [...(material.verbs || [])];
    verbs[vi] = { ...verbs[vi], conjugations: { ...verbs[vi].conjugations, [pronoun]: form } };
    onChange({ ...material, verbs });
  };
  const addVerb = () => {
    onChange({ ...material, verbs: [...(material.verbs || []), { infinitive: '', english: '', conjugations: { je: '', tu: '', 'il/elle': '', nous: '', vous: '', 'ils/elles': '' }, example: '' }] });
  };
  const removeVerb = (vi: number) => {
    onChange({ ...material, verbs: (material.verbs || []).filter((_: any, i: number) => i !== vi) });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <input value={material.instructions || ''} onChange={e => onChange({ ...material, instructions: e.target.value })} placeholder="Instructions (optional)" className={inputCls} />
      {(material.verbs || []).map((v: any, vi: number) => (
        <div key={vi} className="rounded-lg bg-bg-primary/50 p-3 space-y-2 border border-border/50">
          <div className="flex items-center gap-2">
            <input value={v.infinitive || ''} onChange={e => updateVerb(vi, 'infinitive', e.target.value)} className={inputCls + ' flex-1 font-semibold text-accent'} placeholder="Infinitive" />
            <input value={v.english || ''} onChange={e => updateVerb(vi, 'english', e.target.value)} className={inputCls + ' flex-1 text-text-muted'} placeholder="English" />
            <button onClick={() => removeVerb(vi)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
          {v.conjugations && (
            <div className="grid grid-cols-2 gap-1.5 ml-2">
              {Object.entries(v.conjugations).map(([pronoun, form]) => (
                <div key={pronoun} className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted w-16 shrink-0">{pronoun}</span>
                  <input value={(form as string) || ''} onChange={e => updateConj(vi, pronoun, e.target.value)} className={inputCls + ' flex-1'} />
                </div>
              ))}
            </div>
          )}
          <input value={v.example || ''} onChange={e => updateVerb(vi, 'example', e.target.value)} className={inputCls + ' ml-2 italic text-text-secondary'} placeholder="Example sentence" />
        </div>
      ))}
      <button onClick={addVerb} className="text-xs text-accent hover:underline">+ Add Verb</button>
    </div>
  );
}
