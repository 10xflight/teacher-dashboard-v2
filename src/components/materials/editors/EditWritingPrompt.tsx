'use client';

import { inputCls, textareaCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditWritingPrompt({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateReq = (i: number, value: string) => {
    const reqs = [...(material.requirements || [])];
    reqs[i] = value;
    onChange({ ...material, requirements: reqs });
  };
  const addReq = () => {
    onChange({ ...material, requirements: [...(material.requirements || []), ''] });
  };
  const removeReq = (i: number) => {
    onChange({ ...material, requirements: (material.requirements || []).filter((_: any, idx: number) => idx !== i) });
  };
  const updateRubric = (i: number, field: string, value: string) => {
    const rubric = [...(material.rubric || [])];
    rubric[i] = { ...rubric[i], [field]: value };
    onChange({ ...material, rubric });
  };
  const addRubric = () => {
    onChange({ ...material, rubric: [...(material.rubric || []), { category: '', points: '', criteria: '' }] });
  };
  const removeRubric = (i: number) => {
    onChange({ ...material, rubric: (material.rubric || []).filter((_: any, idx: number) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <textarea value={material.prompt || ''} onChange={e => onChange({ ...material, prompt: e.target.value })} rows={4} className={textareaCls} placeholder="Writing prompt..." />
      <div>
        <h5 className="text-xs font-semibold text-text-secondary mb-1">Requirements</h5>
        {(material.requirements || []).map((r: string, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input value={r} onChange={e => updateReq(i, e.target.value)} className={inputCls + ' flex-1'} placeholder="Requirement" />
            <button onClick={() => removeReq(i)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
        ))}
        <button onClick={addReq} className="text-xs text-accent hover:underline">+ Add Requirement</button>
      </div>
      <div>
        <h5 className="text-xs font-semibold text-text-secondary mb-1">Rubric</h5>
        {(material.rubric || []).map((r: any, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input value={r.category || ''} onChange={e => updateRubric(i, 'category', e.target.value)} className={inputCls + ' w-28'} placeholder="Category" />
            <input value={r.points || ''} onChange={e => updateRubric(i, 'points', e.target.value)} className={inputCls + ' w-14 text-center'} placeholder="Pts" />
            <input value={r.criteria || ''} onChange={e => updateRubric(i, 'criteria', e.target.value)} className={inputCls + ' flex-1'} placeholder="Criteria" />
            <button onClick={() => removeRubric(i)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
        ))}
        <button onClick={addRubric} className="text-xs text-accent hover:underline">+ Add Rubric Row</button>
      </div>
    </div>
  );
}
