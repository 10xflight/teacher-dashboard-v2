'use client';

import { inputCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditJeopardy({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateCat = (ci: number, field: string, value: any) => {
    const categories = [...(material.categories || [])];
    categories[ci] = { ...categories[ci], [field]: value };
    onChange({ ...material, categories });
  };
  const updateCatQ = (ci: number, qi: number, field: string, value: any) => {
    const categories = [...(material.categories || [])];
    const questions = [...(categories[ci].questions || [])];
    questions[qi] = { ...questions[qi], [field]: value };
    categories[ci] = { ...categories[ci], questions };
    onChange({ ...material, categories });
  };
  const addCategory = () => {
    onChange({ ...material, categories: [...(material.categories || []), { name: 'New Category', questions: [{ points: 100, question: '', answer: '' }] }] });
  };
  const removeCategory = (ci: number) => {
    onChange({ ...material, categories: (material.categories || []).filter((_: any, i: number) => i !== ci) });
  };
  const addCatQ = (ci: number) => {
    const categories = [...(material.categories || [])];
    const maxPts = Math.max(...(categories[ci].questions || []).map((q: any) => q.points || 0), 0);
    categories[ci] = { ...categories[ci], questions: [...(categories[ci].questions || []), { points: maxPts + 100, question: '', answer: '' }] };
    onChange({ ...material, categories });
  };
  const removeCatQ = (ci: number, qi: number) => {
    const categories = [...(material.categories || [])];
    categories[ci] = { ...categories[ci], questions: categories[ci].questions.filter((_: any, i: number) => i !== qi) };
    onChange({ ...material, categories });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <input value={material.setup || ''} onChange={e => onChange({ ...material, setup: e.target.value })} placeholder="Setup instructions (optional)" className={inputCls} />
      {(material.categories || []).map((cat: any, ci: number) => (
        <div key={ci} className="rounded-lg bg-bg-primary/50 p-3 space-y-2 border border-border/50">
          <div className="flex items-center gap-2">
            <input value={cat.name || ''} onChange={e => updateCat(ci, 'name', e.target.value)} className={inputCls + ' flex-1 font-semibold text-accent'} placeholder="Category name" />
            <button onClick={() => removeCategory(ci)} className="text-accent-red text-xs font-bold shrink-0">&times;</button>
          </div>
          {(cat.questions || []).map((q: any, qi: number) => (
            <div key={qi} className="flex items-start gap-2 ml-2">
              <input type="number" value={q.points || ''} onChange={e => updateCatQ(ci, qi, 'points', parseInt(e.target.value) || 0)} className={inputCls + ' w-16 text-center text-accent-yellow font-bold'} placeholder="$" />
              <div className="flex-1 space-y-1">
                <input value={q.question || ''} onChange={e => updateCatQ(ci, qi, 'question', e.target.value)} className={inputCls} placeholder="Question" />
                <input value={q.answer || ''} onChange={e => updateCatQ(ci, qi, 'answer', e.target.value)} className={inputCls + ' text-accent-green'} placeholder="Answer" />
              </div>
              <button onClick={() => removeCatQ(ci, qi)} className="text-accent-red text-xs font-bold shrink-0 mt-1">&times;</button>
            </div>
          ))}
          <button onClick={() => addCatQ(ci)} className="text-xs text-accent hover:underline ml-2">+ Add Question</button>
        </div>
      ))}
      <button onClick={addCategory} className="text-xs text-accent hover:underline">+ Add Category</button>
    </div>
  );
}
