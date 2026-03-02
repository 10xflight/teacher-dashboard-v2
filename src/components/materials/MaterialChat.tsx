'use client';

import { useState, useRef, useEffect } from 'react';
import type { MaterialType } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MaterialChatProps {
  activityId: number;
  materialType: MaterialType;
  currentMaterial: Record<string, unknown>;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  onChatHistoryChange: (history: { role: 'user' | 'assistant'; content: string }[]) => void;
  onMaterialUpdate: (material: Record<string, unknown>) => void;
}

export default function MaterialChat({
  activityId,
  materialType,
  currentMaterial,
  chatHistory,
  onChatHistoryChange,
  onMaterialUpdate,
}: MaterialChatProps) {
  const [input, setInput] = useState('');
  const [refining, setRefining] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  async function handleSend() {
    const message = input.trim();
    if (!message || refining) return;

    setInput('');
    const newHistory = [...chatHistory, { role: 'user' as const, content: message }];
    onChatHistoryChange(newHistory);
    setRefining(true);

    try {
      const res = await fetch('/api/materials/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activityId,
          material_type: materialType,
          message,
          chat_history: newHistory,
          current_material: currentMaterial,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Refinement failed' }));
        throw new Error(err.error || 'Refinement failed');
      }

      const data = await res.json();
      if (data.material) {
        onMaterialUpdate(data.material);
      }
      onChatHistoryChange([
        ...newHistory,
        { role: 'assistant', content: data.response || 'Done! I\'ve updated the material.' },
      ]);
    } catch (err) {
      onChatHistoryChange([
        ...newHistory,
        { role: 'assistant', content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}` },
      ]);
    } finally {
      setRefining(false);
    }
  }

  return (
    <div className="w-[380px] shrink-0 border-l border-border flex flex-col bg-bg-card material-chat-sidebar">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-text-primary">Refine</h3>
        <p className="text-xs text-text-muted">Ask me to change anything</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-muted">
              Ask me to refine this material. For example:
            </p>
            <div className="mt-3 space-y-1.5">
              {['Add a word bank at the top', 'Make question 3 harder', 'Add 5 more items', 'Change the title'].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-text-secondary bg-bg-secondary rounded-lg hover:bg-hover hover:text-accent transition-colors"
                >
                  &ldquo;{s}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-accent text-white rounded-br-sm'
                : 'bg-bg-secondary text-text-primary rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {refining && (
          <div className="flex justify-start">
            <div className="bg-bg-secondary rounded-xl px-3 py-2 rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask for changes..."
            disabled={refining}
            className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-xs placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || refining}
            className="px-3 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
