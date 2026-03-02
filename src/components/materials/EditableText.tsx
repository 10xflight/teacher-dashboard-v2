'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  as?: 'span' | 'p' | 'h1' | 'h3' | 'h4';
  multiline?: boolean;
}

export default function EditableText({
  value,
  onSave,
  className = '',
  as: Tag = 'span',
  multiline = false,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleSave() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
    setDraft(value);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }

  if (editing) {
    const inputCls = `${className} outline-none ring-2 ring-blue-400 rounded px-1 bg-white`;
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={inputCls + ' w-full min-h-[3em] resize-y'}
          rows={3}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={inputCls + ' w-full'}
      />
    );
  }

  return (
    <Tag
      className={`${className} cursor-pointer hover:bg-blue-50 hover:underline hover:decoration-blue-300 hover:decoration-dotted transition-colors rounded px-0.5`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || <span className="text-gray-300 italic">Click to edit</span>}
    </Tag>
  );
}
