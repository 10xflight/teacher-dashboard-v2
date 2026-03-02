'use client';

import { inputCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditReadingGuide({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateList = (listKey: string, i: number, value: string) => {
    const list = [...(material[listKey] || [])];
    list[i] = value;
    onChange({ ...material, [listKey]: list });
  };
  const addToList = (listKey: string) => {
    onChange({ ...material, [listKey]: [...(material[listKey] || []), ''] });
  };
  const removeFromList = (listKey: string, i: number) => {
    onChange({ ...material, [listKey]: (material[listKey] || []).filter((_: any, idx: number) => idx !== i) });
  };
  const updateDuring = (i: number, field: string, value: string) => {
    const during = [...(material.during_reading || [])];
    during[i] = { ...during[i], [field]: value };
    onChange({ ...material, during_reading: during });
  };
  const addDuring = () => {
    onChange({ ...material, during_reading: [...(material.during_reading || []), { page_or_section: '', question: '' }] });
  };
  const removeDuring = (i: number) => {
    onChange({ ...material, during_reading: (material.during_reading || []).filter((_: any, idx: number) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <div>
        <h5 className="text-xs font-semibold text-accent mb-1">Before Reading</h5>
        {(material.before_reading || []).map((q: string, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input value={q} onChange={e => updateList('before_reading', i, e.target.value)} className={inputCls + ' flex-1'} placeholder="Question" />
            <button onClick={() => removeFromList('before_reading', i)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
        ))}
        <button onClick={() => addToList('before_reading')} className="text-xs text-accent hover:underline">+ Add</button>
      </div>
      <div>
        <h5 className="text-xs font-semibold text-accent mb-1">During Reading</h5>
        {(material.during_reading || []).map((q: any, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input value={q.page_or_section || ''} onChange={e => updateDuring(i, 'page_or_section', e.target.value)} className={inputCls + ' w-24'} placeholder="Page/section" />
            <input value={q.question || ''} onChange={e => updateDuring(i, 'question', e.target.value)} className={inputCls + ' flex-1'} placeholder="Question" />
            <button onClick={() => removeDuring(i)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
        ))}
        <button onClick={addDuring} className="text-xs text-accent hover:underline">+ Add</button>
      </div>
      <div>
        <h5 className="text-xs font-semibold text-accent mb-1">After Reading</h5>
        {(material.after_reading || []).map((q: string, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input value={q} onChange={e => updateList('after_reading', i, e.target.value)} className={inputCls + ' flex-1'} placeholder="Question" />
            <button onClick={() => removeFromList('after_reading', i)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
        ))}
        <button onClick={() => addToList('after_reading')} className="text-xs text-accent hover:underline">+ Add</button>
      </div>
    </div>
  );
}
