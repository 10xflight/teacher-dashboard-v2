'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import EditableText from '../EditableText';
import { updateAtPath, stripLeadingNumber } from '../utils';

export default function QuizPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  const [showAnswers, setShowAnswers] = useState(false);

  const edit = (path: (string | number)[], value: string) => {
    if (onUpdate) onUpdate(updateAtPath(material, path, value));
  };

  return (
    <div className="space-y-5 text-black font-serif">
      {material.instructions && (
        <p className="text-sm italic text-gray-600 mb-4">
          {onUpdate
            ? <EditableText value={material.instructions} onSave={v => edit(['instructions'], v)} className="text-sm italic text-gray-600" />
            : material.instructions}
        </p>
      )}

      {/* Word bank if present */}
      {material.word_bank && material.word_bank.length > 0 && (
        <div className="border-2 border-gray-300 rounded p-3 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Word Bank</p>
          <div className="flex flex-wrap gap-3">
            {material.word_bank.map((w: string, i: number) => (
              <span key={i} className="text-sm">{w}</span>
            ))}
          </div>
        </div>
      )}

      {material.questions?.map((q: any, i: number) => (
        <div key={i} className="mb-4">
          <p className="text-sm font-medium mb-2">
            <span className="font-bold mr-1">{i + 1}.</span>
            {onUpdate
              ? <EditableText value={stripLeadingNumber(q.question)} onSave={v => edit(['questions', i, 'question'], v)} className="text-sm font-medium" />
              : stripLeadingNumber(q.question)}
            {q.points && <span className="text-xs text-gray-400 ml-2">({q.points} pts)</span>}
          </p>
          {q.choices?.map((c: string, ci: number) => {
            const isCorrect = showAnswers && c.startsWith(q.correct);
            return (
              <p key={ci} className={`text-sm ml-8 py-0.5 ${isCorrect ? 'font-bold text-green-700' : ''}`}>
                {onUpdate
                  ? <EditableText value={c} onSave={v => edit(['questions', i, 'choices', ci], v)} className={`text-sm ${isCorrect ? 'font-bold text-green-700' : ''}`} />
                  : c}
              </p>
            );
          })}
          {!q.choices && (
            <div className="ml-8 mt-2 border-b border-gray-300 w-full h-6" />
          )}
          {showAnswers && q.explanation && (
            <p className="text-xs text-green-700 italic ml-8 mt-1">{q.explanation}</p>
          )}
        </div>
      ))}

      {/* Answer key toggle */}
      <div className="pt-4 border-t border-gray-200 mt-6 no-print">
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          {showAnswers ? 'Hide Answer Key' : 'Show Answer Key'}
        </button>
      </div>
    </div>
  );
}
