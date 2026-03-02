'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function GenericPreview({ material }: { material: any }) {
  return (
    <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
      {JSON.stringify(material, null, 2)}
    </pre>
  );
}
