'use client';

import { textareaCls } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditGeneric({ material, onChange }: { material: any; onChange: (m: any) => void }) {
  return (
    <div className="space-y-2">
      {Object.entries(material).filter(([k]) => k !== 'material_type').map(([key, val]) => (
        <div key={key}>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-0.5">{key.replace(/_/g, ' ')}</label>
          {typeof val === 'string' ? (
            <textarea value={val} onChange={e => onChange({ ...material, [key]: e.target.value })} rows={2} className={textareaCls} />
          ) : (
            <pre className="text-xs text-text-secondary bg-bg-primary/50 rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(val, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
