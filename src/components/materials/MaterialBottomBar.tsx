'use client';

import type { MaterialType } from './types';

interface MaterialBottomBarProps {
  viewingExisting: boolean;
  saving: boolean;
  generating: boolean;
  error: string | null;
  selectedType: MaterialType;
  onSave: () => void;
  onRegenerate: () => void;
  onGenerateNew: () => void;
  onBack: () => void;
}

export default function MaterialBottomBar({
  viewingExisting,
  saving,
  generating,
  error,
  selectedType,
  onSave,
  onRegenerate,
  onGenerateNew,
  onBack,
}: MaterialBottomBarProps) {
  return (
    <div className="shrink-0 border-t border-border px-6 py-3 flex items-center gap-3 material-shell">
      {viewingExisting ? (
        <>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2.5 bg-accent-green text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onGenerateNew}
            className="px-4 py-2.5 bg-accent/15 text-accent rounded-lg font-semibold text-sm hover:bg-accent/25 transition-colors"
          >
            Generate New
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2.5 bg-accent-green text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save to Activity'}
          </button>
          <button
            onClick={onRegenerate}
            disabled={generating}
            className="px-4 py-2.5 bg-accent/15 text-accent rounded-lg font-semibold text-sm hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {generating ? 'Regenerating...' : 'Regenerate'}
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2.5 bg-bg-input text-text-secondary rounded-lg font-semibold text-sm hover:bg-hover hover:text-text-primary transition-colors"
          >
            Back
          </button>
        </>
      )}
      <div className="flex-1" />
      {error && (
        <span className="text-accent-red text-sm">{error}</span>
      )}
    </div>
  );
}
