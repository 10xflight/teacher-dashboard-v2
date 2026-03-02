'use client';

import { inputCls, textareaCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditDiscussion({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateQ = (qi: number, field: string, value: string) => {
    const questions = [...(material.questions || [])];
    questions[qi] = { ...questions[qi], [field]: value };
    onChange({ ...material, questions });
  };
  const addQuestion = () => {
    const questions = [...(material.questions || []), { question: '', follow_up: '', type: '' }];
    onChange({ ...material, questions });
  };
  const removeQuestion = (qi: number) => {
    const questions = (material.questions || []).filter((_: any, i: number) => i !== qi);
    onChange({ ...material, questions });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      {(material.questions || []).map((q: any, qi: number) => (
        <div key={qi} className="rounded-lg bg-bg-primary/50 p-3 space-y-2 border border-border/50">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-text-muted mt-1.5 shrink-0 w-5">{qi + 1}.</span>
            <textarea value={q.question || ''} onChange={e => updateQ(qi, 'question', e.target.value)} rows={2} className={textareaCls + ' flex-1'} placeholder="Question" />
            <button onClick={() => removeQuestion(qi)} className="text-accent-red text-xs font-bold shrink-0 mt-1">&times;</button>
          </div>
          <input value={q.follow_up || ''} onChange={e => updateQ(qi, 'follow_up', e.target.value)} placeholder="Follow-up question (optional)" className={inputCls + ' ml-7'} />
          <select value={q.type || ''} onChange={e => updateQ(qi, 'type', e.target.value)} className={inputCls + ' ml-7 w-40'}>
            <option value="">Type</option>
            <option value="recall">Recall</option>
            <option value="analysis">Analysis</option>
            <option value="evaluation">Evaluation</option>
            <option value="creative">Creative</option>
            <option value="personal">Personal</option>
          </select>
        </div>
      ))}
      <button onClick={addQuestion} className="text-xs text-accent hover:underline">+ Add Question</button>
    </div>
  );
}
