'use client';

import type { MaterialType } from './types';

interface MaterialToolbarProps {
  activityTitle: string;
  className: string;
  activityDate?: string;
  selectedType: MaterialType | null;
  editing: boolean;
  viewingExisting: boolean;
  isFullScreen: boolean;
  exporting: boolean;
  onExport: (includeAnswers: boolean) => void;
  onPrint: () => void;
  onEditToggle: () => void;
  onClose: () => void;
}

export default function MaterialToolbar({
  activityTitle,
  className,
  activityDate,
  selectedType,
  editing,
  viewingExisting,
  isFullScreen,
  exporting,
  onExport,
  onPrint,
  onEditToggle,
  onClose,
}: MaterialToolbarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 material-shell">
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text-primary truncate">
            {editing ? 'Edit Materials' : viewingExisting ? 'Materials' : 'Material Generator'}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-accent truncate">{activityTitle}</p>
            <span className="text-xs text-text-muted shrink-0">
              {className}
              {activityDate && <> &middot; {activityDate}</>}
            </span>
          </div>
        </div>
        {selectedType && (
          <span className="text-xs text-accent bg-accent/10 px-2.5 py-1 rounded-full font-medium shrink-0">
            {selectedType.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {isFullScreen && !editing && (
          <>
            <button
              onClick={() => onExport(false)}
              disabled={exporting}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/25 transition-colors disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export Student'}
            </button>
            <button
              onClick={() => onExport(true)}
              disabled={exporting}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/25 transition-colors disabled:opacity-50"
            >
              Export Key
            </button>
            <button
              onClick={onPrint}
              className="px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              Print
            </button>
            <button
              onClick={onEditToggle}
              className="px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              Edit
            </button>
          </>
        )}
        {isFullScreen && editing && (
          <button
            onClick={onEditToggle}
            className="px-3 py-1.5 text-xs font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30 rounded-lg hover:bg-accent-green/25 transition-colors"
          >
            Done Editing
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
