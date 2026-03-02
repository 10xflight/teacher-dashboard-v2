'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import EditableText from '../EditableText';
import { updateAtPath, stripLeadingNumber } from '../utils';

export default function WorksheetPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  const [showAnswers, setShowAnswers] = useState(false);

  const edit = (path: (string | number)[], value: string) => {
    if (onUpdate) onUpdate(updateAtPath(material, path, value));
  };

  return (
    <div className="space-y-6 text-black font-serif">
      {material.instructions && (
        <p className="text-sm italic text-gray-600">
          {onUpdate
            ? <EditableText value={material.instructions} onSave={v => edit(['instructions'], v)} className="text-sm italic text-gray-600" />
            : material.instructions}
        </p>
      )}

      {/* Word bank if present */}
      {material.word_bank && material.word_bank.length > 0 && (
        <div className="border-2 border-gray-300 rounded p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Word Bank</p>
          <div className="flex flex-wrap gap-4">
            {material.word_bank.map((w: string, i: number) => (
              <span key={i} className="text-sm">{w}</span>
            ))}
          </div>
        </div>
      )}

      {material.sections?.map((s: any, si: number) => (
        <div key={si}>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-3">
            {onUpdate
              ? <EditableText value={s.heading} onSave={v => edit(['sections', si, 'heading'], v)} className="text-sm font-bold uppercase tracking-wide" />
              : s.heading}
            {s.type && <span className="font-normal text-gray-500 text-xs ml-2 normal-case">({s.type})</span>}
          </h3>

          {s.items?.map((item: any, ii: number) => (
            <div key={ii} className="mb-3 ml-2">
              <p className="text-sm">
                <span className="font-medium">{ii + 1}.</span>{' '}
                {onUpdate
                  ? <EditableText value={stripLeadingNumber(item.prompt)} onSave={v => edit(['sections', si, 'items', ii, 'prompt'], v)} className="text-sm" />
                  : stripLeadingNumber(item.prompt)}
              </p>
              {showAnswers && item.answer ? (
                <p className="text-xs text-green-700 ml-6 mt-1 italic">Answer: {item.answer}</p>
              ) : (
                <div className="ml-6 mt-1 border-b border-gray-300 w-[90%] h-5" />
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Extension section if present */}
      {material.extension && (
        <div className="border-t-2 border-gray-300 pt-4 mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Early Finishers</h3>
          <p className="text-sm">{material.extension}</p>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200 mt-6 no-print">
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          {showAnswers ? 'Hide Answers' : 'Show Answers'}
        </button>
      </div>
    </div>
  );
}
