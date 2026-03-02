'use client';

import { ReactNode } from 'react';

interface DocumentPreviewProps {
  title?: string;
  children: ReactNode;
}

export default function DocumentPreview({ title, children }: DocumentPreviewProps) {
  return (
    <div className="document-preview bg-white text-black max-w-[8.5in] mx-auto shadow-xl rounded-sm border border-gray-200"
      style={{ padding: '0.75in 1in' }}
    >
      {/* Student header: Name / Date / Period */}
      <div className="flex items-end justify-between mb-4 pb-1 border-b border-gray-300 text-sm font-serif">
        <div className="flex gap-6">
          <span>Name: <span className="inline-block w-48 border-b border-gray-400" /></span>
          <span>Date: <span className="inline-block w-28 border-b border-gray-400" /></span>
          <span>Period: <span className="inline-block w-12 border-b border-gray-400" /></span>
        </div>
      </div>

      {/* Title */}
      {title && (
        <h1 className="text-xl font-bold text-center mb-6 font-serif">{title}</h1>
      )}

      {/* Content */}
      {children}
    </div>
  );
}
