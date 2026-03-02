'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function WritingPromptPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  return (
    <div className="space-y-5 text-black font-serif">
      {/* Prompt in bordered box */}
      {material.prompt && (
        <div className="border-2 border-gray-300 rounded p-4 bg-gray-50">
          <p className="text-sm leading-relaxed">{material.prompt}</p>
        </div>
      )}

      {/* Requirements */}
      {material.requirements && material.requirements.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-2">Requirements</h3>
          <ul className="list-disc ml-6 space-y-1">
            {material.requirements.map((r: string, i: number) => (
              <li key={i} className="text-sm">{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pre-writing suggestions */}
      {material.pre_writing && material.pre_writing.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-2">Pre-Writing</h3>
          <ul className="list-disc ml-6 space-y-1">
            {material.pre_writing.map((s: string, i: number) => (
              <li key={i} className="text-sm">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Word count */}
      {material.word_count && (
        <p className="text-sm font-medium">Word Count: {material.word_count}</p>
      )}

      {/* Rubric as HTML table */}
      {material.rubric && material.rubric.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide border-b border-black pb-1 mb-2">Rubric</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-left font-bold">Category</th>
                <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-center font-bold w-16">Points</th>
                <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-left font-bold">Criteria</th>
              </tr>
            </thead>
            <tbody>
              {material.rubric.map((r: any, i: number) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{r.category}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{r.points}</td>
                  <td className="border border-gray-300 px-2 py-1">{r.criteria}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-gray-400 px-2 py-1">Total</td>
                <td className="border border-gray-400 px-2 py-1 text-center">
                  {material.rubric.reduce((sum: number, r: any) => sum + (Number(r.points) || 0), 0)}
                </td>
                <td className="border border-gray-400 px-2 py-1" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
