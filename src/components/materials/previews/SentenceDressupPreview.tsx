'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { stripLeadingNumber } from '../utils';

export default function SentenceDressupPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  const [showExamples, setShowExamples] = useState(false);

  return (
    <div className="space-y-5 text-black font-serif">
      {material.instructions && (
        <p className="text-sm italic text-gray-600">{material.instructions}</p>
      )}

      {material.sentences?.map((s: any, i: number) => (
        <div key={i} className="mb-4">
          <p className="text-sm">
            <span className="font-bold">{i + 1}.</span> {stripLeadingNumber(s.base)}
          </p>
          <p className="text-xs text-gray-500 ml-6 mt-1">
            Technique: <span className="font-semibold">{s.technique}</span>
          </p>
          {showExamples && s.example && (
            <p className="text-sm text-green-700 ml-6 mt-1 italic">Example: {s.example}</p>
          )}
          {/* Student writing space */}
          <div className="ml-6 mt-2 space-y-2">
            <div className="border-b border-gray-200 w-full h-5" />
            <div className="border-b border-gray-200 w-full h-5" />
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-gray-200 mt-6 no-print">
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          {showExamples ? 'Hide Examples' : 'Show Examples'}
        </button>
      </div>
    </div>
  );
}
