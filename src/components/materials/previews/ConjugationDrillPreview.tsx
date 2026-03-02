'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { stripLeadingNumber } from '../utils';

export default function ConjugationDrillPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <div className="space-y-6 text-black font-serif">
      {material.instructions && (
        <p className="text-sm italic text-gray-600">{material.instructions}</p>
      )}

      {/* Conjugation tables */}
      {material.verbs?.map((v: any, i: number) => (
        <div key={i}>
          <h3 className="text-sm font-bold mb-2">
            {v.infinitive} <span className="font-normal text-gray-500">({v.english})</span>
          </h3>
          {v.conjugations && (
            <table className="w-full max-w-md border-collapse text-sm ml-4 mb-2">
              <tbody>
                {Object.entries(v.conjugations).map(([pronoun, form]) => (
                  <tr key={pronoun} className="border-b border-gray-200">
                    <td className="py-1 pr-4 text-gray-500 w-24">{pronoun}</td>
                    <td className="py-1 font-medium">{showAnswers ? form as string : <span className="inline-block w-32 border-b border-gray-300" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {v.example && (
            <p className="text-xs text-gray-600 italic ml-4">{v.example}</p>
          )}
        </div>
      ))}

      {/* Exercises */}
      {material.exercises && material.exercises.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-3">Exercises</h3>
          {material.exercises.map((ex: any, i: number) => (
            <div key={i} className="mb-3 ml-2">
              <p className="text-sm">{i + 1}. {stripLeadingNumber(ex.prompt)}</p>
              {showAnswers && ex.answer ? (
                <p className="text-xs text-green-700 ml-6 mt-0.5">({ex.answer})</p>
              ) : (
                <div className="ml-6 mt-1 border-b border-gray-300 w-48 h-5" />
              )}
            </div>
          ))}
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
