'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { stripLeadingNumber } from '../utils';

export default function DialogueBuilderPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  return (
    <div className="space-y-5 text-black font-serif">
      {material.scenario && (
        <p className="text-sm italic text-gray-600">{material.scenario}</p>
      )}

      {/* Vocabulary box */}
      {material.vocabulary && material.vocabulary.length > 0 && (
        <div className="border-2 border-gray-300 rounded p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Key Vocabulary</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {material.vocabulary.map((v: any, i: number) => (
              <div key={i} className="text-sm">
                <span className="font-bold">{v.french}</span>
                <span className="text-gray-500"> &mdash; {v.english}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model dialogue — two-column */}
      {material.model_dialogue && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-3">Model Dialogue</h3>
          <div className="space-y-2 ml-2">
            {material.model_dialogue.map((line: any, i: number) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-bold shrink-0 w-6">{line.speaker}:</span>
                <div>
                  <span>{line.french}</span>
                  <span className="text-gray-500 text-xs ml-2">({line.english})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practice prompts */}
      {material.practice_prompts && material.practice_prompts.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-3">Practice</h3>
          {material.practice_prompts.map((p: string, i: number) => (
            <div key={i} className="mb-3 ml-2">
              <p className="text-sm">{i + 1}. {stripLeadingNumber(p)}</p>
              <div className="ml-6 mt-1 space-y-2">
                <div className="border-b border-gray-200 w-full h-5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
