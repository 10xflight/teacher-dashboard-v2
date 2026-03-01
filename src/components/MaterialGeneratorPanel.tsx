'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportToDocx } from '@/lib/material-exporter';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActivityForPanel {
  id: number;
  title: string;
  description: string | null;
  class_id: number;
  date?: string;
  material_status?: string;
  material_content?: Record<string, unknown> | null;
  classes: { name: string } | null;
}

interface MaterialGeneratorPanelProps {
  activity: ActivityForPanel;
  onClose: () => void;
  onSaved: () => void;
}

type MaterialType =
  | 'quiz' | 'vocabulary_test' | 'grammar_test' | 'sentence_dressup'
  | 'worksheet' | 'discussion_questions' | 'writing_prompt' | 'reading_guide'
  | 'jeopardy' | 'dice_game' | 'card_match' | 'relay_race'
  | 'buzzer_quiz' | 'guess_who' | 'four_corners' | 'vocab_bingo'
  | 'flashcard_set' | 'conjugation_drill' | 'dialogue_builder' | 'cultural_activity';

interface MaterialCategory {
  label: string;
  types: { key: MaterialType; label: string }[];
}

// ── Material Type Categories ───────────────────────────────────────────────────

const ASSESSMENTS: MaterialCategory = {
  label: 'Assessments',
  types: [
    { key: 'quiz', label: 'Quiz' },
    { key: 'vocabulary_test', label: 'Vocabulary Test' },
    { key: 'grammar_test', label: 'Grammar Test' },
    { key: 'sentence_dressup', label: 'Sentence Dressup' },
  ],
};

const WORKSHEETS: MaterialCategory = {
  label: 'Worksheets',
  types: [
    { key: 'worksheet', label: 'Worksheet' },
    { key: 'discussion_questions', label: 'Discussion Qs' },
    { key: 'writing_prompt', label: 'Writing Prompt' },
    { key: 'reading_guide', label: 'Reading Guide' },
  ],
};

const GAMES: MaterialCategory = {
  label: 'Games',
  types: [
    { key: 'jeopardy', label: 'Jeopardy' },
    { key: 'dice_game', label: 'Dice Game' },
    { key: 'card_match', label: 'Card Match' },
    { key: 'relay_race', label: 'Relay Race' },
    { key: 'buzzer_quiz', label: 'Buzzer Quiz' },
    { key: 'guess_who', label: 'Guess Who' },
    { key: 'four_corners', label: 'Four Corners' },
    { key: 'vocab_bingo', label: 'Vocab Bingo' },
  ],
};

const FRENCH: MaterialCategory = {
  label: 'French',
  types: [
    { key: 'flashcard_set', label: 'Flashcard Set' },
    { key: 'conjugation_drill', label: 'Conjugation Drill' },
    { key: 'dialogue_builder', label: 'Dialogue Builder' },
    { key: 'cultural_activity', label: 'Cultural Activity' },
  ],
};

// ── Visual Editors for each material type ────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

// Shared small input style
const inputCls = 'w-full px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none';
const textareaCls = 'w-full px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none resize-none';

function EditQuiz({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditWorksheet({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditDiscussion({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditWritingPrompt({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditFlashcards({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  const updateCard = (i: number, field: string, value: string) => {
    const cards = [...(material.cards || [])];
    cards[i] = { ...cards[i], [field]: value };
    onChange({ ...material, cards });
  };
  const addCard = () => {
    onChange({ ...material, cards: [...(material.cards || []), { front: '', back: '', pronunciation: '', example_sentence: '' }] });
  };
  const removeCard = (i: number) => {
    onChange({ ...material, cards: (material.cards || []).filter((_: any, idx: number) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      <input value={material.title || ''} onChange={e => onChange({ ...material, title: e.target.value })} placeholder="Title" className={inputCls + ' font-semibold'} />
      <input value={material.instructions || ''} onChange={e => onChange({ ...material, instructions: e.target.value })} placeholder="Instructions (optional)" className={inputCls} />
      <div className="space-y-2">
        {(material.cards || []).map((card: any, i: number) => (
          <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1.5 border border-border/50">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-1.5">
                <input value={card.front || ''} onChange={e => updateCard(i, 'front', e.target.value)} className={inputCls + ' font-semibold text-accent'} placeholder="Front (term)" />
                <input value={card.back || ''} onChange={e => updateCard(i, 'back', e.target.value)} className={inputCls} placeholder="Back (definition)" />
                <input value={card.pronunciation || ''} onChange={e => updateCard(i, 'pronunciation', e.target.value)} className={inputCls + ' text-text-muted italic'} placeholder="Pronunciation (optional)" />
                <input value={card.example_sentence || ''} onChange={e => updateCard(i, 'example_sentence', e.target.value)} className={inputCls} placeholder="Example sentence (optional)" />
              </div>
              <button onClick={() => removeCard(i)} className="text-accent-red text-xs font-bold shrink-0 mt-1">&times;</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addCard} className="text-xs text-accent hover:underline">+ Add Card</button>
    </div>
  );
}

function EditSentenceDressup({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditJeopardy({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditGame({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditReadingGuide({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

function EditConjugationDrill({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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

// Generic fallback editor — simple key-value text editing
function EditGeneric({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  return (
    <div className="space-y-2">
      {Object.entries(material).filter(([k]) => k !== 'material_type').map(([key, val]) => (
        <div key={key}>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-0.5">{key.replace(/_/g, ' ')}</label>
          {typeof val === 'string' ? (
            <textarea value={val} onChange={e => onChange({ ...material, [key]: e.target.value })} rows={2} className={textareaCls} />
          ) : (
            <pre className="text-xs text-text-secondary bg-bg-primary/50 rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(val, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

// Pick the right editor for the material type
function renderMaterialEditor(material: any, materialType: MaterialType, onChange: (m: any) => void) {
  if (['quiz', 'vocabulary_test', 'grammar_test'].includes(materialType) && material.questions) {
    return <EditQuiz material={material} onChange={onChange} />;
  }
  if (materialType === 'sentence_dressup') return <EditSentenceDressup material={material} onChange={onChange} />;
  if (materialType === 'worksheet') return <EditWorksheet material={material} onChange={onChange} />;
  if (materialType === 'discussion_questions') return <EditDiscussion material={material} onChange={onChange} />;
  if (materialType === 'writing_prompt') return <EditWritingPrompt material={material} onChange={onChange} />;
  if (materialType === 'reading_guide') return <EditReadingGuide material={material} onChange={onChange} />;
  if (materialType === 'jeopardy') return <EditJeopardy material={material} onChange={onChange} />;
  if (materialType === 'flashcard_set') return <EditFlashcards material={material} onChange={onChange} />;
  if (materialType === 'conjugation_drill') return <EditConjugationDrill material={material} onChange={onChange} />;
  if (['dice_game', 'card_match', 'relay_race', 'buzzer_quiz', 'guess_who', 'four_corners', 'vocab_bingo'].includes(materialType)) {
    return <EditGame material={material} onChange={onChange} />;
  }
  return <EditGeneric material={material} onChange={onChange} />;
}

// ── Renderers for different material structures (view mode) ──────────────────

function renderQuizTest(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.questions?.map((q: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1.5">
          <p className="text-sm text-text-primary font-medium">
            {i + 1}. {q.question}
          </p>
          {q.choices?.map((c: string, ci: number) => (
            <p key={ci} className={`text-xs ml-4 ${
              c.startsWith(q.correct) ? 'text-accent-green font-semibold' : 'text-text-secondary'
            }`}>
              {c}
            </p>
          ))}
          {q.explanation && (
            <p className="text-xs text-text-muted ml-4 italic">
              {q.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function renderWorksheet(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.sections?.map((s: any, si: number) => (
        <div key={si} className="space-y-2">
          <h5 className="text-xs font-semibold text-accent uppercase tracking-wider">
            {s.heading} {s.type && <span className="text-text-muted font-normal">({s.type})</span>}
          </h5>
          {s.items?.map((item: any, ii: number) => (
            <div key={ii} className="rounded-lg bg-bg-primary/50 p-2.5">
              <p className="text-sm text-text-primary">{ii + 1}. {item.prompt}</p>
              {item.answer && (
                <p className="text-xs text-accent-green mt-1 ml-4">Answer: {item.answer}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderDiscussionQuestions(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.questions?.map((q: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
          <p className="text-sm text-text-primary font-medium">{i + 1}. {q.question}</p>
          {q.follow_up && (
            <p className="text-xs text-text-secondary ml-4">Follow-up: {q.follow_up}</p>
          )}
          {q.type && (
            <span className="text-[0.65rem] text-text-muted ml-4 uppercase">{q.type}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function renderWritingPrompt(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.prompt && (
        <p className="text-sm text-text-primary leading-relaxed bg-bg-primary/50 p-3 rounded-lg">
          {material.prompt}
        </p>
      )}
      {material.requirements && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Requirements</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.requirements.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {material.rubric && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Rubric</h5>
          {material.rubric.map((r: any, i: number) => (
            <div key={i} className="flex items-baseline gap-2 text-xs text-text-secondary">
              <span className="font-medium text-text-primary">{r.category}</span>
              <span className="text-accent-yellow">{r.points}pts</span>
              <span>{r.criteria}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderReadingGuide(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.before_reading && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Before Reading</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.before_reading.map((q: string, i: number) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
      {material.during_reading && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">During Reading</h5>
          {material.during_reading.map((q: any, i: number) => (
            <div key={i} className="text-xs text-text-secondary ml-2">
              <span className="text-text-muted">[{q.page_or_section}]</span> {q.question}
            </div>
          ))}
        </div>
      )}
      {material.after_reading && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">After Reading</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.after_reading.map((q: string, i: number) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderJeopardy(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.setup && (
        <p className="text-xs text-text-secondary italic">{material.setup}</p>
      )}
      {material.categories?.map((cat: any, ci: number) => (
        <div key={ci} className="space-y-1.5">
          <h5 className="text-xs font-semibold text-accent uppercase tracking-wider">
            {cat.name}
          </h5>
          {cat.questions?.map((q: any, qi: number) => (
            <div key={qi} className="flex items-start gap-3 rounded-lg bg-bg-primary/50 p-2.5">
              <span className="text-xs font-bold text-accent-yellow shrink-0 w-8">
                ${q.points}
              </span>
              <div className="flex-1">
                <p className="text-xs text-text-primary">{q.question}</p>
                <p className="text-xs text-accent-green mt-0.5">{q.answer}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderGame(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.setup && (
        <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
          <h5 className="text-xs font-semibold text-accent mb-1">Setup Instructions</h5>
          <p className="text-xs text-text-secondary">{material.setup}</p>
        </div>
      )}
      {material.rules && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Rules</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {material.items?.map((item: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-2.5">
          <p className="text-sm text-text-primary">{i + 1}. {item.prompt}</p>
          {item.answer && (
            <p className="text-xs text-accent-green mt-0.5 ml-4">Answer: {item.answer}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function renderSentenceDressup(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.sentences?.map((s: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
          <p className="text-sm text-text-primary">{i + 1}. {s.base}</p>
          <p className="text-xs text-accent ml-4">Technique: {s.technique}</p>
          <p className="text-xs text-accent-green ml-4">Example: {s.example}</p>
        </div>
      ))}
    </div>
  );
}

function renderFlashcards(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {material.cards?.map((card: any, i: number) => (
          <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
            <p className="text-sm font-semibold text-accent">{card.front}</p>
            <p className="text-sm text-text-primary">{card.back}</p>
            {card.pronunciation && (
              <p className="text-xs text-text-muted italic">[{card.pronunciation}]</p>
            )}
            {card.example_sentence && (
              <p className="text-xs text-text-secondary">{card.example_sentence}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderConjugationDrill(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.verbs?.map((v: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-accent">{v.infinitive}</span>
            <span className="text-xs text-text-muted">({v.english})</span>
          </div>
          {v.conjugations && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs ml-2">
              {Object.entries(v.conjugations).map(([pronoun, form]) => (
                <div key={pronoun} className="flex gap-2">
                  <span className="text-text-muted w-14">{pronoun}</span>
                  <span className="text-text-primary">{form as string}</span>
                </div>
              ))}
            </div>
          )}
          {v.example && (
            <p className="text-xs text-text-secondary italic ml-2">{v.example}</p>
          )}
        </div>
      ))}
      {material.exercises && material.exercises.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Exercises</h5>
          {material.exercises.map((ex: any, i: number) => (
            <div key={i} className="text-xs text-text-secondary ml-2">
              {i + 1}. {ex.prompt}
              {ex.answer && <span className="text-accent-green ml-2">({ex.answer})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderDialogueBuilder(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.scenario && (
        <p className="text-xs text-text-secondary italic">{material.scenario}</p>
      )}
      {material.vocabulary && material.vocabulary.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Key Vocabulary</h5>
          <div className="flex flex-wrap gap-1.5">
            {material.vocabulary.map((v: any, i: number) => (
              <span key={i} className="text-xs bg-bg-primary/50 rounded px-2 py-0.5 text-text-secondary">
                <span className="text-accent">{v.french}</span> = {v.english}
              </span>
            ))}
          </div>
        </div>
      )}
      {material.model_dialogue && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Model Dialogue</h5>
          <div className="space-y-1.5 ml-2">
            {material.model_dialogue.map((line: any, i: number) => (
              <div key={i} className={`text-xs rounded-lg p-2 ${
                line.speaker === 'A' ? 'bg-accent/10 ml-0 mr-8' : 'bg-bg-primary/50 ml-8 mr-0'
              }`}>
                <span className="font-semibold text-text-muted">Speaker {line.speaker}: </span>
                <span className="text-text-primary">{line.french}</span>
                <span className="text-text-muted ml-2">({line.english})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {material.practice_prompts && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Practice</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.practice_prompts.map((p: string, i: number) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderCulturalActivity(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.topic && (
        <p className="text-xs text-accent font-semibold uppercase">{material.topic}</p>
      )}
      {material.background && (
        <p className="text-xs text-text-secondary leading-relaxed">{material.background}</p>
      )}
      {material.activities?.map((a: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] text-text-muted uppercase">{a.type}</span>
          </div>
          <p className="text-sm text-text-primary">{a.description}</p>
          <p className="text-xs text-text-secondary">{a.instructions}</p>
        </div>
      ))}
      {material.vocabulary && material.vocabulary.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Vocabulary</h5>
          <div className="flex flex-wrap gap-1.5">
            {material.vocabulary.map((v: any, i: number) => (
              <span key={i} className="text-xs bg-bg-primary/50 rounded px-2 py-0.5 text-text-secondary">
                <span className="text-accent">{v.french}</span> = {v.english}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderMaterialPreview(material: any, materialType: MaterialType) {
  // Quiz / Test types
  if (['quiz', 'vocabulary_test', 'grammar_test'].includes(materialType) && material.questions) {
    return renderQuizTest(material);
  }
  // Sentence dressup
  if (materialType === 'sentence_dressup' && material.sentences) {
    return renderSentenceDressup(material);
  }
  // Worksheet
  if (materialType === 'worksheet' && material.sections) {
    return renderWorksheet(material);
  }
  // Discussion questions
  if (materialType === 'discussion_questions' && material.questions) {
    return renderDiscussionQuestions(material);
  }
  // Writing prompt
  if (materialType === 'writing_prompt' && material.prompt) {
    return renderWritingPrompt(material);
  }
  // Reading guide
  if (materialType === 'reading_guide') {
    return renderReadingGuide(material);
  }
  // Jeopardy
  if (materialType === 'jeopardy' && material.categories) {
    return renderJeopardy(material);
  }
  // Other games
  if (['dice_game', 'card_match', 'relay_race', 'buzzer_quiz', 'guess_who', 'four_corners', 'vocab_bingo'].includes(materialType)) {
    return renderGame(material);
  }
  // Flashcards
  if (materialType === 'flashcard_set' && material.cards) {
    return renderFlashcards(material);
  }
  // Conjugation drill
  if (materialType === 'conjugation_drill' && material.verbs) {
    return renderConjugationDrill(material);
  }
  // Dialogue builder
  if (materialType === 'dialogue_builder') {
    return renderDialogueBuilder(material);
  }
  // Cultural activity
  if (materialType === 'cultural_activity') {
    return renderCulturalActivity(material);
  }

  // Fallback: pretty-printed JSON
  return (
    <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
      {JSON.stringify(material, null, 2)}
    </pre>
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MaterialGeneratorPanel({
  activity,
  onClose,
  onSaved,
}: MaterialGeneratorPanelProps) {
  // Detect material type from content structure
  function detectMaterialType(content: Record<string, unknown>): MaterialType {
    if (content.material_type) return content.material_type as MaterialType;
    if (content.sentences) return 'sentence_dressup';
    if (content.cards) return 'flashcard_set';
    if (content.verbs) return 'conjugation_drill';
    if (content.model_dialogue) return 'dialogue_builder';
    if (content.categories) return 'jeopardy';
    if (content.before_reading || content.during_reading) return 'reading_guide';
    if (content.prompt && content.requirements) return 'writing_prompt';
    if (content.sections) return 'worksheet';
    if (content.setup && content.items) return 'dice_game';
    if (content.topic && content.background) return 'cultural_activity';
    if (content.questions && content.questions instanceof Array) {
      const q = (content.questions as Record<string, unknown>[])[0];
      if (q?.follow_up) return 'discussion_questions';
      return 'quiz';
    }
    return 'worksheet';
  }

  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingExisting, setViewingExisting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const className = activity.classes?.name || 'Unknown Class';
  const isFrench = className.toLowerCase().includes('french');

  // On mount: if activity has material_status='ready', fetch from API to get latest content
  useEffect(() => {
    if (activity.material_status === 'ready') {
      // Try local data first
      if (activity.material_content && Object.keys(activity.material_content).length > 0) {
        const content = activity.material_content;
        setGeneratedMaterial(content);
        setSelectedType(detectMaterialType(content));
        setViewingExisting(true);
      } else {
        // Fetch from API
        setLoadingExisting(true);
        fetch(`/api/activities/${activity.id}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.material_content && Object.keys(data.material_content).length > 0) {
              setGeneratedMaterial(data.material_content);
              setSelectedType(detectMaterialType(data.material_content));
              setViewingExisting(true);
            }
          })
          .catch(() => {})
          .finally(() => setLoadingExisting(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEditChange(updated: any) {
    setGeneratedMaterial({ ...updated, material_type: selectedType });
  }

  async function handleExport(includeAnswers: boolean) {
    if (!generatedMaterial || !selectedType) return;
    setExporting(true);
    try {
      await exportToDocx(generatedMaterial, selectedType, activity.title, includeAnswers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
    setExporting(false);
  }

  const categories: MaterialCategory[] = [ASSESSMENTS, WORKSHEETS, GAMES];
  if (isFrench) categories.push(FRENCH);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const generate = useCallback(async (type: MaterialType, notes?: string) => {
    setGenerating(true);
    setError(null);
    setGeneratedMaterial(null);
    setSelectedType(type);
    setViewingExisting(false);
    setEditing(false);

    try {
      const res = await fetch('/api/materials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activity.id,
          material_type: type,
          teacher_notes: notes || teacherNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(data.error || 'Generation failed');
      }

      const data = await res.json();
      setGeneratedMaterial(data.material);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [activity.id, teacherNotes]);

  async function saveToActivity() {
    if (!generatedMaterial) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_status: 'ready',
          material_content: { ...generatedMaterial, material_type: selectedType },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(data.error || 'Save failed');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function markReadyNoMaterials() {
    setSaving(true);
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_status: 'ready' }),
      });
      onSaved();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function markUploadReady() {
    setSaving(true);
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_status: 'ready' }),
      });
      onSaved();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  function handleCustomGenerate() {
    if (!customPrompt.trim()) return;
    // Default to worksheet if no type selected yet
    const type = selectedType || 'worksheet';
    generate(type, customPrompt.trim());
  }

  // Full-screen when viewing/editing materials, centered modal when picking type
  const isFullScreen = !!(generatedMaterial && selectedType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />

      {/* Panel — full-screen for viewer/editor, centered card for generator picker */}
      <div className={`relative flex flex-col bg-bg-card shadow-2xl animate-panel-in ${
        isFullScreen
          ? 'w-full h-full'
          : 'w-full max-w-lg max-h-[90vh] rounded-2xl border border-border mx-4'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary truncate">
                {editing ? 'Edit Materials' : viewingExisting ? 'Materials' : 'Material Generator'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-accent truncate">{activity.title}</p>
                <span className="text-xs text-text-muted shrink-0">
                  {className}
                  {activity.date && <> &middot; {activity.date}</>}
                </span>
              </div>
            </div>
            {selectedType && (
              <span className="text-xs text-accent bg-accent/10 px-2.5 py-1 rounded-full font-medium shrink-0">
                {selectedType.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {/* Action buttons in header when viewing */}
            {isFullScreen && !editing && (
              <>
                <button
                  onClick={() => handleExport(false)}
                  disabled={exporting}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export Student'}
                </button>
                <button
                  onClick={() => handleExport(true)}
                  disabled={exporting}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                >
                  Export Answer Key
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border rounded-lg hover:border-accent hover:text-accent transition-colors"
                >
                  Edit
                </button>
              </>
            )}
            {isFullScreen && editing && (
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30 rounded-lg hover:bg-accent-green/25 transition-colors"
              >
                Done Editing
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading existing materials */}
          {loadingExisting && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-secondary">Loading materials...</p>
            </div>
          )}

          {/* Show generated/existing content — FULL SCREEN */}
          {!loadingExisting && generatedMaterial && selectedType ? (
            <div className="h-full flex flex-col">
              {/* Material preview OR edit mode — takes all available space */}
              <div className="flex-1 overflow-y-auto p-6 lg:px-16 xl:px-24">
                <div className="max-w-4xl mx-auto">
                  {editing ? (
                    renderMaterialEditor(generatedMaterial, selectedType, handleEditChange)
                  ) : (
                    renderMaterialPreview(generatedMaterial, selectedType)
                  )}
                </div>
              </div>

              {/* Bottom bar */}
              <div className="shrink-0 border-t border-border px-6 py-3 flex items-center gap-3">
                {viewingExisting ? (
                  <>
                    <button
                      onClick={saveToActivity}
                      disabled={saving}
                      className="px-5 py-2.5 bg-accent-green text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setViewingExisting(false);
                        setGeneratedMaterial(null);
                        setSelectedType(null);
                        setEditing(false);
                        setError(null);
                      }}
                      className="px-4 py-2.5 bg-accent/15 text-accent rounded-lg font-semibold text-sm hover:bg-accent/25 transition-colors"
                    >
                      Generate New
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveToActivity}
                      disabled={saving}
                      className="px-5 py-2.5 bg-accent-green text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save to Activity'}
                    </button>
                    <button
                      onClick={() => generate(selectedType)}
                      disabled={generating}
                      className="px-4 py-2.5 bg-accent/15 text-accent rounded-lg font-semibold text-sm hover:bg-accent/25 transition-colors disabled:opacity-50"
                    >
                      {generating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                    <button
                      onClick={() => {
                        setGeneratedMaterial(null);
                        setSelectedType(null);
                        setEditing(false);
                        setError(null);
                      }}
                      className="px-4 py-2.5 bg-bg-input text-text-secondary rounded-lg font-semibold text-sm hover:bg-hover hover:text-text-primary transition-colors"
                    >
                      Back
                    </button>
                  </>
                )}
                <div className="flex-1" />
                {error && (
                  <span className="text-accent-red text-sm">{error}</span>
                )}
              </div>
            </div>
          ) : !loadingExisting ? (
            <div className="p-6 space-y-5">
              {/* Material type grid */}
              {categories.map(cat => (
                <div key={cat.label}>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    {cat.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cat.types.map(t => (
                      <button
                        key={t.key}
                        onClick={() => generate(t.key)}
                        disabled={generating}
                        className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-all text-left
                          ${selectedType === t.key && generating
                            ? 'bg-accent/20 border-accent text-accent'
                            : 'bg-bg-secondary border-border text-text-secondary hover:border-accent hover:text-accent hover:bg-accent/10'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {selectedType === t.key && generating ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            Generating...
                          </span>
                        ) : (
                          t.label
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Teacher notes */}
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
                  Notes for AI (optional)
                </label>
                <textarea
                  value={teacherNotes}
                  onChange={e => setTeacherNotes(e.target.value)}
                  placeholder="e.g. focus on chapters 3-4, make it easier, include vocabulary from last week..."
                  rows={2}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-text-muted font-semibold uppercase">OR</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Quick actions */}
              <div className="space-y-2">
                <button
                  onClick={markUploadReady}
                  disabled={saving}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary bg-bg-secondary border border-border rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    I already have materials &mdash; mark as ready
                  </span>
                </button>

                <button
                  onClick={markReadyNoMaterials}
                  disabled={saving}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary bg-bg-secondary border border-border rounded-lg hover:border-accent-green hover:text-accent-green transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    No materials needed for this activity
                  </span>
                </button>
              </div>

              {/* Loading state */}
              {generating && !generatedMaterial && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-text-secondary">Generating {selectedType?.replace(/_/g, ' ')}...</p>
                  <p className="text-xs text-text-muted">This usually takes 10-20 seconds</p>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="rounded-lg bg-accent-red/15 border border-accent-red/30 p-4">
                  <p className="text-accent-red text-sm">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-accent-red/70 hover:text-accent-red mt-1 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
