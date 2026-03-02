'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';

export default function GamePreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <div className="space-y-5 text-black font-serif">
      {/* Setup box */}
      {material.setup && (
        <div className="border border-gray-300 bg-gray-50 rounded p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Setup Instructions</p>
          <p className="text-sm">{material.setup}</p>
        </div>
      )}

      {/* Materials list if present */}
      {material.materials_needed && material.materials_needed.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Materials Needed</h3>
          <ul className="list-disc ml-6 text-sm space-y-0.5">
            {material.materials_needed.map((m: string, i: number) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {/* Rules */}
      {material.rules && material.rules.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-2">Rules</h3>
          <ol className="list-decimal ml-6 text-sm space-y-1">
            {material.rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ol>
        </div>
      )}

      {/* Time estimate and team sizes */}
      <div className="flex gap-4 text-xs text-gray-500">
        {material.time_estimate && <span>Time: {material.time_estimate}</span>}
        {material.team_size && <span>Team Size: {material.team_size}</span>}
      </div>

      {/* Printable card grid */}
      {material.items && material.items.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-3">Game Cards</h3>
          <div className="grid grid-cols-2 gap-2">
            {material.items.map((item: any, i: number) => (
              <div key={i} className="border border-gray-400 rounded p-2 text-center text-sm min-h-[60px] flex flex-col items-center justify-center">
                <p className="font-medium">{item.prompt}</p>
                {showAnswers && item.answer && (
                  <p className="text-xs text-green-700 mt-1">{item.answer}</p>
                )}
              </div>
            ))}
          </div>
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
