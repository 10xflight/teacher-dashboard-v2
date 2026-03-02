'use client';

import { inputCls, textareaCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditGame({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateItem = (i: number, field: string, value: string) => {
    const items = [...(material.items || [])];
    items[i] = { ...items[i], [field]: value };
    onChange({ ...material, items });
  };
  const updateRule = (i: number, value: string) => {
    const rules = [...(material.rules || [])];
    rules[i] = value;
    onChange({ ...material, rules });
  };
  const addItem = () => {
    onChange({ ...material, items: [...(material.items || []), { prompt: '', answer: '' }] });
  };
  const removeItem = (i: number) => {
    onChange({ ...material, items: (material.items || []).filter((_: any, idx: number) => idx !== i) });
  };
  const addRule = () => {
    onChange({ ...material, rules: [...(material.rules || []), ''] });
  };
  const removeRule = (i: number) => {
    onChange({ ...material, rules: (material.rules || []).filter((_: any, idx: number) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <textarea value={material.setup || ''} onChange={e => onChange({ ...material, setup: e.target.value })} rows={2} className={textareaCls} placeholder="Setup instructions" />
      <div>
        <h5 className="text-xs font-semibold text-text-secondary mb-1">Rules</h5>
        {(material.rules || []).map((r: string, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input value={r} onChange={e => updateRule(i, e.target.value)} className={inputCls + ' flex-1'} placeholder="Rule" />
            <button onClick={() => removeRule(i)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
        ))}
        <button onClick={addRule} className="text-xs text-accent hover:underline">+ Add Rule</button>
      </div>
      <div>
        <h5 className="text-xs font-semibold text-text-secondary mb-1">Items</h5>
        {(material.items || []).map((item: any, i: number) => (
          <div key={i} className="flex items-start gap-2 mb-2 ml-2 pl-2 border-l-2 border-border/30">
            <span className="text-xs text-text-muted mt-1.5 shrink-0 w-4">{i + 1}.</span>
            <div className="flex-1 space-y-1">
              <input value={item.prompt || ''} onChange={e => updateItem(i, 'prompt', e.target.value)} className={inputCls} placeholder="Prompt/question" />
              <input value={item.answer || ''} onChange={e => updateItem(i, 'answer', e.target.value)} className={inputCls + ' text-accent-green'} placeholder="Answer" />
            </div>
            <button onClick={() => removeItem(i)} className="text-accent-red text-xs font-bold shrink-0 mt-1">&times;</button>
          </div>
        ))}
        <button onClick={addItem} className="text-xs text-accent hover:underline">+ Add Item</button>
      </div>
    </div>
  );
}
