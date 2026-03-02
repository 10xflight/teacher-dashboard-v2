'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportToDocx } from '@/lib/material-exporter';
import { printMaterialPreview } from './printMaterial';
import type { MaterialType, MaterialGeneratorPanelProps, MaterialCategory } from './types';
import { ASSESSMENTS, WORKSHEETS, GAMES, FRENCH } from './constants';
import MaterialToolbar from './MaterialToolbar';
import MaterialBottomBar from './MaterialBottomBar';
import MaterialTypePicker from './MaterialTypePicker';
import MaterialPreview from './MaterialPreview';
import MaterialEditor from './MaterialEditor';
import MaterialChat from './MaterialChat';
import DocumentPreview from './DocumentPreview';

/* eslint-disable @typescript-eslint/no-explicit-any */

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function detectMaterialType(content: Record<string, unknown>): MaterialType {
  if (content.material_type) return content.material_type as MaterialType;
  if (content.sentences) return 'sentence_dressup';
  if (content.cards) return 'flashcard_set';
  if (content.verbs) return 'conjugation_drill';
  if (content.model_dialogue) return 'dialogue_builder';
  if (content.categories) return 'jeopardy';
  if (content.before_reading || content.during_reading) return 'reading_guide';
  if (content.prompt && content.requirements) return 'writing_prompt';
  if (content.sections) return 'worksheet';
  if (content.setup && content.items) return 'dice_game';
  if (content.topic && content.background) return 'cultural_activity';
  if (content.questions && content.questions instanceof Array) {
    const q = (content.questions as Record<string, unknown>[])[0];
    if (q?.follow_up) return 'discussion_questions';
    return 'quiz';
  }
  return 'worksheet';
}

export default function MaterialGeneratorPanel({
  activity,
  onClose,
  onSaved,
}: MaterialGeneratorPanelProps) {
  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingExisting, setViewingExisting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [showChat, setShowChat] = useState(false);

  const className = activity.classes?.name || 'Unknown Class';
  const isFrench = className.toLowerCase().includes('french');

  // On mount: if activity has material_status='ready', fetch from API
  useEffect(() => {
    if (activity.material_status === 'ready') {
      if (activity.material_content && Object.keys(activity.material_content).length > 0) {
        const content = activity.material_content;
        setGeneratedMaterial(content);
        setSelectedType(detectMaterialType(content));
        setViewingExisting(true);
        setShowChat(true);
      } else {
        setLoadingExisting(true);
        fetch(`/api/activities/${activity.id}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.material_content && Object.keys(data.material_content).length > 0) {
              setGeneratedMaterial(data.material_content);
              setSelectedType(detectMaterialType(data.material_content));
              setViewingExisting(true);
              setShowChat(true);
            }
          })
          .catch(() => {})
          .finally(() => setLoadingExisting(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEditChange(updated: any) {
    setGeneratedMaterial({ ...updated, material_type: selectedType });
  }

  async function handleExport(includeAnswers: boolean) {
    if (!generatedMaterial || !selectedType) return;
    setExporting(true);
    try {
      await exportToDocx(generatedMaterial, selectedType, activity.title, includeAnswers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
    setExporting(false);
  }

  const categories: MaterialCategory[] = [ASSESSMENTS, WORKSHEETS, GAMES];
  if (isFrench) categories.push(FRENCH);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const generate = useCallback(async (
    type: MaterialType,
    notes?: string,
    planHistory?: ChatMsg[],
  ) => {
    setGenerating(true);
    setError(null);
    setGeneratedMaterial(null);
    setSelectedType(type);
    setViewingExisting(false);
    setEditing(false);
    setChatHistory([]);
    setShowChat(false);

    try {
      const res = await fetch('/api/materials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activity.id,
          material_type: type,
          teacher_notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(data.error || 'Generation failed');
      }

      const data = await res.json();
      setGeneratedMaterial(data.material);
      setShowChat(true);

      // Seed refinement chat with the planning conversation
      if (planHistory && planHistory.length > 0) {
        setChatHistory([
          ...planHistory,
          { role: 'assistant', content: `I've generated your ${type.replace(/_/g, ' ')}. Let me know if you'd like any changes!` },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [activity.id]);

  async function saveToActivity() {
    if (!generatedMaterial) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_status: 'ready',
          material_content: { ...generatedMaterial, material_type: selectedType },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(data.error || 'Save failed');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function markReadyNoMaterials() {
    setSaving(true);
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_status: 'ready' }),
      });
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function markUploadReady() {
    setSaving(true);
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_status: 'ready' }),
      });
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  function handleMaterialUpdate(updated: Record<string, unknown>) {
    setGeneratedMaterial({ ...updated, material_type: selectedType });
  }

  const isFullScreen = !!(generatedMaterial && selectedType);

  return (
    <div className="material-panel-root fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay */}
      <div
        className="material-panel-overlay absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`material-panel-container relative flex flex-col bg-bg-card shadow-2xl animate-panel-in ${
        isFullScreen
          ? 'w-full h-full'
          : 'w-full max-w-lg max-h-[90vh] rounded-2xl border border-border mx-4'
      }`}>
        {/* Header */}
        <MaterialToolbar
          activityTitle={activity.title}
          className={className}
          activityDate={activity.date}
          selectedType={selectedType}
          editing={editing}
          viewingExisting={viewingExisting}
          isFullScreen={isFullScreen}
          exporting={exporting}
          onExport={handleExport}
          onPrint={printMaterialPreview}
          onEditToggle={() => setEditing(!editing)}
          onClose={onClose}
        />

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Loading existing materials */}
          {loadingExisting && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-secondary">Loading materials...</p>
            </div>
          )}

          {/* Show generated/existing content — FULL SCREEN */}
          {!loadingExisting && generatedMaterial && selectedType ? (
            <div className="h-full flex flex-col">
              {/* Content area: preview + optional chat sidebar */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Preview or edit area */}
                <div className={`flex-1 overflow-y-auto document-preview-wrapper ${editing ? 'p-6 lg:px-16 xl:px-24' : 'bg-gray-700 p-6 lg:p-10'}`}>
                  {editing ? (
                    <div className="max-w-4xl mx-auto">
                      <MaterialEditor
                        material={generatedMaterial}
                        materialType={selectedType}
                        onChange={handleEditChange}
                      />
                    </div>
                  ) : (
                    <DocumentPreview title={generatedMaterial.title as string}>
                      <MaterialPreview
                        material={generatedMaterial}
                        materialType={selectedType}
                        onUpdate={handleMaterialUpdate}
                      />
                    </DocumentPreview>
                  )}
                </div>

                {/* Chat sidebar */}
                {showChat && !editing && (
                  <MaterialChat
                    activityId={activity.id}
                    materialType={selectedType}
                    currentMaterial={generatedMaterial}
                    chatHistory={chatHistory}
                    onChatHistoryChange={setChatHistory}
                    onMaterialUpdate={handleMaterialUpdate}
                  />
                )}
              </div>

              {/* Bottom bar */}
              <MaterialBottomBar
                viewingExisting={viewingExisting}
                saving={saving}
                generating={generating}
                error={error}
                selectedType={selectedType}
                onSave={saveToActivity}
                onRegenerate={() => generate(selectedType)}
                onGenerateNew={() => {
                  setViewingExisting(false);
                  setGeneratedMaterial(null);
                  setSelectedType(null);
                  setEditing(false);
                  setError(null);
                  setChatHistory([]);
                  setShowChat(false);
                }}
                onBack={() => {
                  setGeneratedMaterial(null);
                  setSelectedType(null);
                  setEditing(false);
                  setError(null);
                  setChatHistory([]);
                  setShowChat(false);
                }}
              />
            </div>
          ) : !loadingExisting ? (
            <div className="h-full overflow-y-auto">
              <MaterialTypePicker
                categories={categories}
                selectedType={selectedType}
                generating={generating}
                saving={saving}
                error={error}
                generatedMaterial={generatedMaterial}
                activityId={activity.id}
                activityTitle={activity.title}
                activityClassName={className}
                onGenerate={(type, prompt, history) => generate(type, prompt || undefined, history)}
                onMarkUploadReady={markUploadReady}
                onMarkReadyNoMaterials={markReadyNoMaterials}
                onDismissError={() => setError(null)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
