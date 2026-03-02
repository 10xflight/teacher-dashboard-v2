'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import EditableText from '../EditableText';
import { updateAtPath, stripLeadingNumber } from '../utils';

export default function DiscussionPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  const edit = (path: (string | number)[], value: string) => {
    if (onUpdate) onUpdate(updateAtPath(material, path, value));
  };

  return (
    <div className="space-y-6 text-black font-serif">
      {material.questions?.map((q: any, i: number) => (
        <div key={i} className="mb-4">
          <div className="flex items-start gap-2">
            <span className="font-bold text-sm shrink-0">{i + 1}.</span>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {onUpdate
                  ? <EditableText value={stripLeadingNumber(q.question)} onSave={v => edit(['questions', i, 'question'], v)} className="text-sm font-medium" />
                  : stripLeadingNumber(q.question)}
              </p>
              {q.follow_up && (
                <p className="text-sm text-gray-600 ml-4 mt-1 italic">
                  Follow-up: {onUpdate
                    ? <EditableText value={q.follow_up} onSave={v => edit(['questions', i, 'follow_up'], v)} className="text-sm text-gray-600 italic" />
                    : q.follow_up}
                </p>
              )}
              {q.type && (
                <span className="inline-block text-[0.6rem] font-bold uppercase tracking-wider text-gray-400 mt-1 border border-gray-300 px-1.5 py-0.5 rounded">
                  {q.type}
                </span>
              )}
              <div className="mt-2 space-y-3">
                <div className="border-b border-gray-200 w-full h-5" />
                <div className="border-b border-gray-200 w-full h-5" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
