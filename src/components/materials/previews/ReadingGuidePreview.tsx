'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { stripLeadingNumber } from '../utils';

export default function ReadingGuidePreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  return (
    <div className="space-y-6 text-black font-serif">
      {/* Vocabulary preview if present */}
      {material.vocabulary && material.vocabulary.length > 0 && (
        <div className="border-2 border-gray-300 rounded p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Key Vocabulary</p>
          <div className="flex flex-wrap gap-3">
            {material.vocabulary.map((v: any, i: number) => (
              <span key={i} className="text-sm">
                <span className="font-bold">{typeof v === 'string' ? v : v.word}</span>
                {v.definition && <span className="text-gray-600"> &mdash; {v.definition}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {material.before_reading && material.before_reading.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b-2 border-black pb-1 mb-3">Before Reading</h3>
          {material.before_reading.map((q: string, i: number) => (
            <div key={i} className="mb-3 ml-2">
              <p className="text-sm">{i + 1}. {stripLeadingNumber(q)}</p>
              <div className="ml-4 mt-1 space-y-2">
                <div className="border-b border-gray-200 w-full h-5" />
                <div className="border-b border-gray-200 w-full h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {material.during_reading && material.during_reading.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b-2 border-black pb-1 mb-3">During Reading</h3>
          {material.during_reading.map((q: any, i: number) => (
            <div key={i} className="mb-3 ml-2">
              <p className="text-sm">
                <span className="font-bold">[{q.page_or_section}]</span> {stripLeadingNumber(q.question)}
              </p>
              <div className="ml-4 mt-1 space-y-2">
                <div className="border-b border-gray-200 w-full h-5" />
                <div className="border-b border-gray-200 w-full h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {material.after_reading && material.after_reading.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b-2 border-black pb-1 mb-3">After Reading</h3>
          {material.after_reading.map((q: string, i: number) => (
            <div key={i} className="mb-3 ml-2">
              <p className="text-sm">{i + 1}. {stripLeadingNumber(q)}</p>
              <div className="ml-4 mt-1 space-y-2">
                <div className="border-b border-gray-200 w-full h-5" />
                <div className="border-b border-gray-200 w-full h-5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
