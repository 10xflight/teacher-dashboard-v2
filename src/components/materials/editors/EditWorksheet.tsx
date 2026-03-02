'use client';

import { inputCls, textareaCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditWorksheet({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateSection = (si: number, field: string, value: any) => {
    const sections = [...(material.sections || [])];
    sections[si] = { ...sections[si], [field]: value };
    onChange({ ...material, sections });
  };
  const updateItem = (si: number, ii: number, field: string, value: string) => {
    const sections = [...(material.sections || [])];
    const items = [...(sections[si].items || [])];
    items[ii] = { ...items[ii], [field]: value };
    sections[si] = { ...sections[si], items };
    onChange({ ...material, sections });
  };
  const addItem = (si: number) => {
    const sections = [...(material.sections || [])];
    sections[si] = { ...sections[si], items: [...(sections[si].items || []), { prompt: '', answer: '' }] };
    onChange({ ...material, sections });
  };
  const removeItem = (si: number, ii: number) => {
    const sections = [...(material.sections || [])];
    sections[si] = { ...sections[si], items: sections[si].items.filter((_: any, i: number) => i !== ii) };
    onChange({ ...material, sections });
  };
  const addSection = () => {
    const sections = [...(material.sections || []), { heading: 'New Section', type: '', items: [{ prompt: '', answer: '' }] }];
    onChange({ ...material, sections });
  };
  const removeSection = (si: number) => {
    const sections = (material.sections || []).filter((_: any, i: number) => i !== si);
    onChange({ ...material, sections });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <input value={material.instructions || ''} onChange={e => onChange({ ...material, instructions: e.target.value })} placeholder="Instructions (optional)" className={inputCls} />
      {(material.sections || []).map((s: any, si: number) => (
        <div key={si} className="rounded-lg bg-bg-primary/50 p-3 space-y-2 border border-border/50">
          <div className="flex items-center gap-2">
            <input value={s.heading || ''} onChange={e => updateSection(si, 'heading', e.target.value)} placeholder="Section heading" className={inputCls + ' flex-1 font-semibold text-accent'} />
            <input value={s.type || ''} onChange={e => updateSection(si, 'type', e.target.value)} placeholder="Type" className={inputCls + ' w-28'} />
            <button onClick={() => removeSection(si)} className="text-accent-red text-xs font-bold shrink-0" title="Remove section">&times;</button>
          </div>
          {(s.items || []).map((item: any, ii: number) => (
            <div key={ii} className="space-y-1 ml-2 pl-2 border-l-2 border-border/30">
              <div className="flex items-start gap-2">
                <span className="text-xs text-text-muted mt-1.5 shrink-0 w-4">{ii + 1}.</span>
                <textarea value={item.prompt || ''} onChange={e => updateItem(si, ii, 'prompt', e.target.value)} rows={2} className={textareaCls + ' flex-1'} placeholder="Question/prompt" />
                <button onClick={() => removeItem(si, ii)} className="text-accent-red text-xs font-bold shrink-0 mt-1">&times;</button>
              </div>
              <div className="ml-6">
                <input value={item.answer || ''} onChange={e => updateItem(si, ii, 'answer', e.target.value)} placeholder="Answer" className={inputCls + ' text-accent-green'} />
              </div>
            </div>
          ))}
          <button onClick={() => addItem(si)} className="text-xs text-accent hover:underline ml-2">+ Add Item</button>
        </div>
      ))}
      <button onClick={addSection} className="text-xs text-accent hover:underline">+ Add Section</button>
    </div>
  );
}
