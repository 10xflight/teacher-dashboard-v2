'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';

export default function JeopardyPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  const [showAnswers, setShowAnswers] = useState(false);
  const categories = material.categories || [];
  const maxQuestions = Math.max(...categories.map((c: any) => c.questions?.length || 0), 0);

  return (
    <div className="text-black font-serif">
      {material.setup && (
        <div className="border border-gray-300 bg-gray-50 rounded p-3 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Teacher Setup</p>
          <p className="text-sm">{material.setup}</p>
        </div>
      )}

      {/* Grid layout */}
      {categories.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr>
                {categories.map((cat: any, ci: number) => (
                  <th key={ci} className="border border-gray-400 bg-blue-900 text-white px-2 py-2 text-xs font-bold uppercase tracking-wide">
                    {cat.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxQuestions }).map((_, row) => (
                <tr key={row}>
                  {categories.map((cat: any, ci: number) => {
                    const q = cat.questions?.[row];
                    return (
                      <td key={ci} className="border border-gray-300 px-2 py-3 align-top">
                        {q ? (
                          <div>
                            <div className="text-lg font-bold text-blue-800">${q.points}</div>
                            {showAnswers && (
                              <div className="mt-1">
                                <p className="text-xs text-gray-600">{q.question}</p>
                                <p className="text-xs text-green-700 font-medium mt-0.5">{q.answer}</p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Final Jeopardy if present */}
      {material.final_jeopardy && (
        <div className="border-2 border-blue-800 rounded p-4 mt-6 text-center">
          <h3 className="text-sm font-bold uppercase text-blue-800 mb-2">Final Jeopardy</h3>
          <p className="text-sm">{material.final_jeopardy.question || material.final_jeopardy.clue}</p>
          {showAnswers && material.final_jeopardy.answer && (
            <p className="text-sm text-green-700 font-medium mt-2">{material.final_jeopardy.answer}</p>
          )}
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
