'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function CulturalActivityPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  return (
    <div className="space-y-5 text-black font-serif">
      {material.topic && (
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{material.topic}</p>
      )}
      {material.background && (
        <div className="border-l-4 border-gray-300 pl-4">
          <p className="text-sm leading-relaxed">{material.background}</p>
        </div>
      )}

      {material.activities?.map((a: any, i: number) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-gray-400 border border-gray-300 px-1.5 py-0.5 rounded">
              {a.type}
            </span>
          </div>
          <h4 className="text-sm font-bold mb-1">{a.description}</h4>
          <p className="text-sm text-gray-700">{a.instructions}</p>
          {/* Student writing space */}
          <div className="mt-2 space-y-2">
            <div className="border-b border-gray-200 w-full h-5" />
            <div className="border-b border-gray-200 w-full h-5" />
          </div>
        </div>
      ))}

      {/* Vocabulary */}
      {material.vocabulary && material.vocabulary.length > 0 && (
        <div className="border-2 border-gray-300 rounded p-3 mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Vocabulary</p>
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
    </div>
  );
}
