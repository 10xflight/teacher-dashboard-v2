'use client';

import { inputCls, textareaCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditQuiz({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateQ = (qi: number, field: string, value: any) => {
    const questions = [...(material.questions || [])];
    questions[qi] = { ...questions[qi], [field]: value };
    onChange({ ...material, questions });
  };
  const updateChoice = (qi: number, ci: number, value: string) => {
    const questions = [...(material.questions || [])];
    const choices = [...(questions[qi].choices || [])];
    choices[ci] = value;
    questions[qi] = { ...questions[qi], choices };
    onChange({ ...material, questions });
  };
  const addQuestion = () => {
    const questions = [...(material.questions || []), { question: '', choices: ['A) ', 'B) ', 'C) ', 'D) '], correct: 'A', explanation: '' }];
    onChange({ ...material, questions });
  };
  const removeQuestion = (qi: number) => {
    const questions = (material.questions || []).filter((_: any, i: number) => i !== qi);
    onChange({ ...material, questions });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <input value={material.instructions || ''} onChange={e => onChange({ ...material, instructions: e.target.value })} placeholder="Instructions (optional)" className={inputCls} />
      {(material.questions || []).map((q: any, qi: number) => (
        <div key={qi} className="rounded-lg bg-bg-primary/50 p-3 space-y-2 border border-border/50">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-text-muted mt-1.5 shrink-0 w-5">{qi + 1}.</span>
            <textarea value={q.question || ''} onChange={e => updateQ(qi, 'question', e.target.value)} rows={2} className={textareaCls + ' flex-1'} placeholder="Question text" />
            <button onClick={() => removeQuestion(qi)} className="text-accent-red text-xs font-bold shrink-0 mt-1" title="Remove">&times;</button>
          </div>
          {q.choices?.map((c: string, ci: number) => (
            <div key={ci} className="flex items-center gap-2 ml-7">
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correct === c.charAt(0)}
                onChange={() => updateQ(qi, 'correct', c.charAt(0))}
                className="accent-accent-green shrink-0"
                title="Mark as correct answer"
              />
              <input value={c} onChange={e => updateChoice(qi, ci, e.target.value)} className={inputCls + ' flex-1'} />
            </div>
          ))}
          <input value={q.explanation || ''} onChange={e => updateQ(qi, 'explanation', e.target.value)} placeholder="Explanation (optional)" className={inputCls + ' ml-7 text-text-muted italic'} />
        </div>
      ))}
      <button onClick={addQuestion} className="text-xs text-accent hover:underline">+ Add Question</button>
    </div>
  );
}
