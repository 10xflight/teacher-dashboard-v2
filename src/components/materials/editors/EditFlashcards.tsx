'use client';

import { inputCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditFlashcards({ material, onChange }: { material: any; onChange: (m: any) => void }) {
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
