'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { ClassInfo, Task } from '@/lib/types';
import { parseNaturalDate, matchClass, formatShortDate, localDateStr } from '@/lib/task-helpers';
import { ChevronDown, ChevronRight, Trash2, Check, Calendar, Search } from 'lucide-react';

export default function TaskArchivePage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [todo, setTodo] = useState<Task[]>([]);
  const [done, setDone] = useState<Task[]>([]);
  const [showDone, setShowDone] = useState(true);

  // Filter & sort
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'created_date'>('due_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchText, setSearchText] = useState('');

  // Add row state
  const [addText, setAddText] = useState('');
  const [addClassId, setAddClassId] = useState<number | null | undefined>(undefined);
  const [addClassDisplay, setAddClassDisplay] = useState('');
  const [addDueInput, setAddDueInput] = useState('');
  const [addDueResolved, setAddDueResolved] = useState('');

  // Inline edit state
  const [editingCell, setEditingCell] = useState<{ taskId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Class dropdown state
  const [showClassDropdown, setShowClassDropdown] = useState<number | 'add' | null>(null);
  const [classHighlight, setClassHighlight] = useState(-1);

  // Refs
  const addTextRef = useRef<HTMLInputElement>(null);
  const addClassRef = useRef<HTMLInputElement>(null);
  const addDueRef = useRef<HTMLInputElement>(null);
  const addDatePickerRef = useRef<HTMLInputElement>(null);

  const getClassName = (classId: number | null) => {
    if (!classId) return 'General';
    const cls = classes.find(c => c.id === classId);
    return cls?.name || 'General';
  };

  function getLastUsedClassId(): number | null {
    try {
      const stored = localStorage.getItem('lastTaskClassId');
      if (stored) return parseInt(stored);
    } catch {}
    return null;
  }

  function getFilteredClasses() {
    const q = addClassDisplay.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(c => {
      const name = c.name.toLowerCase();
      if (name.includes(q)) return true;
      if (name.startsWith(q)) return true;
      const abbrMatch = q.match(/^([a-z])(\d+)$/);
      if (abbrMatch) {
        return name.startsWith(abbrMatch[1]) && name.includes(abbrMatch[2]);
      }
      if (q.length === 1) return name.startsWith(q);
      return false;
    });
  }

  // Load classes
  useEffect(() => {
    fetch('/api/classes')
      .then(r => r.json())
      .then(setClasses)
      .catch(() => {});
  }, []);

  // Load tasks
  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterClassId !== 'all') params.set('class_id', filterClassId);
    params.set('sort', sortBy);
    params.set('dir', sortDir);

    try {
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTodo(data.todo || []);
      setDone(data.done || []);
    } catch { /* ignore */ }
  }, [filterClassId, sortBy, sortDir]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Apply text search filter
  const searchLower = searchText.toLowerCase();
  const filteredTodo = searchText
    ? todo.filter(t => t.text.toLowerCase().includes(searchLower))
    : todo;
  const filteredDone = searchText
    ? done.filter(t => t.text.toLowerCase().includes(searchLower))
    : done;

  // CRUD operations
  async function addTask() {
    if (!addText.trim()) return;

    let classId: number | null = null;
    if (addClassId !== undefined) {
      classId = addClassId;
    } else if (addClassDisplay.trim()) {
      classId = matchClass(addClassDisplay, classes);
    } else {
      classId = getLastUsedClassId();
    }

    const dueDate = addDueResolved || (addDueInput ? parseNaturalDate(addDueInput) : null);

    const body: Record<string, unknown> = {
      text: addText.trim(),
      due_date: dueDate,
    };
    if (classId !== null) {
      body.class_id = classId;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) return;

      if (classId !== null) {
        try { localStorage.setItem('lastTaskClassId', String(classId)); } catch {}
      }

      setAddText('');
      setAddClassId(undefined);
      setAddClassDisplay('');
      setAddDueInput('');
      setAddDueResolved('');
      loadTasks();
      setTimeout(() => addTextRef.current?.focus(), 50);
    } catch {}
  }

  async function toggleTask(id: number, isDone: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: isDone }),
    });
    loadTasks();
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
  }

  async function updateTask(id: number, field: string, value: string) {
    const body: Record<string, unknown> = {};

    if (field === 'text') {
      if (!value.trim()) return;
      body.text = value.trim();
    } else if (field === 'due_date') {
      body.due_date = value ? parseNaturalDate(value) : null;
    } else if (field === 'class_id') {
      body.class_id = matchClass(value, classes);
    }

    if (Object.keys(body).length === 0) return;

    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEditingCell(null);
    loadTasks();
  }

  function setClassForTask(taskId: number | 'add', classId: number | null) {
    if (taskId === 'add') {
      setAddClassId(classId);
      setAddClassDisplay(classId === null ? 'General' : getClassName(classId));
      setShowClassDropdown(null);
      setTimeout(() => addDueRef.current?.focus(), 50);
    } else {
      fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: classId }),
      }).then(() => loadTasks());
      setShowClassDropdown(null);
    }
  }

  function startEdit(taskId: number, field: string, currentValue: string) {
    setEditingCell({ taskId, field });
    setEditValue(currentValue);
  }

  function saveEdit() {
    if (!editingCell) return;
    updateTask(editingCell.taskId, editingCell.field, editValue);
  }

  function resolveAddClass() {
    if (addClassDisplay.trim()) {
      const matched = matchClass(addClassDisplay, classes);
      const display = matched !== null ? getClassName(matched) : 'General';
      setAddClassId(matched);
      setAddClassDisplay(display);
    }
    setShowClassDropdown(null);
    setClassHighlight(-1);
  }

  function resolveDueDate() {
    if (addDueInput.trim()) {
      const parsed = parseNaturalDate(addDueInput);
      if (parsed) {
        setAddDueResolved(parsed);
        setAddDueInput(formatShortDate(parsed) || addDueInput);
      }
    }
  }

  function handleClassKeyDown(e: React.KeyboardEvent) {
    const allOptions = [{ id: null, name: 'General' }, ...getFilteredClasses()];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setClassHighlight(h => Math.min(h + 1, allOptions.length - 1));
      if (showClassDropdown !== 'add') setShowClassDropdown('add');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setClassHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (classHighlight >= 0 && classHighlight < allOptions.length) {
        setClassForTask('add', allOptions[classHighlight].id);
      } else {
        resolveAddClass();
      }
      if (addText.trim()) {
        setTimeout(() => addTask(), 50);
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (classHighlight >= 0 && classHighlight < allOptions.length) {
        setClassForTask('add', allOptions[classHighlight].id);
      } else {
        resolveAddClass();
      }
      setTimeout(() => addDueRef.current?.focus(), 30);
    } else if (e.key === 'Escape') {
      setShowClassDropdown(null);
      setClassHighlight(-1);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Task Archive</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {filteredTodo.length} pending, {filteredDone.length} completed
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSortBy(s => s === 'due_date' ? 'created_date' : 'due_date')}
            className="text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-hover"
          >
            Sort: {sortBy === 'due_date' ? 'Due Date' : 'Created'}
          </button>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-hover"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search tasks..."
          className="w-full pl-9 pr-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent placeholder:text-text-muted"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setFilterClassId('all')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            filterClassId === 'all'
              ? 'bg-accent text-bg-primary'
              : 'bg-bg-input text-text-secondary hover:bg-hover'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterClassId('null')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            filterClassId === 'null'
              ? 'bg-accent text-bg-primary'
              : 'bg-bg-input text-text-secondary hover:bg-hover'
          }`}
        >
          General
        </button>
        {classes.map(cls => (
          <button
            key={cls.id}
            onClick={() => setFilterClassId(String(cls.id))}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filterClassId === String(cls.id)
                ? 'bg-accent text-bg-primary'
                : 'bg-bg-input text-text-secondary hover:bg-hover'
            }`}
          >
            {cls.name}
          </button>
        ))}
      </div>

      {/* Pending tasks card */}
      <div className="rounded-xl bg-bg-card border border-border p-5 mb-4">
        {/* Table header */}
        <div className="grid grid-cols-[28px_1fr_80px_28px] md:grid-cols-[28px_1fr_90px_80px_80px_28px] gap-0 border-b border-border pb-1.5 mb-1">
          <div></div>
          <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1">Task</div>
          <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1 hidden md:block">Class</div>
          <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1">Due</div>
          <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1 hidden md:block">Created</div>
          <div></div>
        </div>

        {/* Task rows */}
        <div className="space-y-0">
          {filteredTodo.map(task => (
            <div
              key={task.id}
              className="grid grid-cols-[28px_1fr_80px_28px] md:grid-cols-[28px_1fr_90px_80px_80px_28px] gap-0 items-center group py-1.5 border-b border-border/30 hover:bg-hover/30 transition-colors"
            >
              {/* Checkbox */}
              <div className="flex justify-center">
                <button
                  onClick={() => toggleTask(task.id, true)}
                  className="w-4 h-4 rounded border border-border hover:border-accent shrink-0 transition-colors"
                />
              </div>

              {/* Text */}
              <div className="px-1 min-w-0">
                {editingCell?.taskId === task.id && editingCell?.field === 'text' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                    onBlur={saveEdit}
                    className="w-full px-1 py-0.5 bg-bg-input border border-accent rounded text-text-primary text-sm focus:outline-none"
                  />
                ) : (
                  <span
                    className="text-sm text-text-secondary cursor-pointer hover:text-text-primary truncate block"
                    onClick={() => startEdit(task.id, 'text', task.text)}
                  >
                    {task.text}
                  </span>
                )}
              </div>

              {/* Class */}
              <div className="px-1 relative hidden md:block">
                <span
                  className="text-xs text-text-muted cursor-pointer hover:text-text-primary truncate block"
                  onClick={() => { setShowClassDropdown(showClassDropdown === task.id ? null : task.id); setClassHighlight(-1); }}
                >
                  {getClassName(task.class_id)}
                </span>
                {showClassDropdown === task.id && (
                  <ClassDropdown
                    classes={classes}
                    highlightIndex={-1}
                    onSelect={(cid) => setClassForTask(task.id, cid)}
                    onClose={() => setShowClassDropdown(null)}
                  />
                )}
              </div>

              {/* Due date */}
              <div className="px-1">
                {editingCell?.taskId === task.id && editingCell?.field === 'due_date' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                    onBlur={saveEdit}
                    placeholder="fri, 3/1..."
                    className="w-full px-1 py-0.5 bg-bg-input border border-accent rounded text-text-primary text-xs focus:outline-none"
                  />
                ) : (
                  <span
                    className="text-xs text-text-muted cursor-pointer hover:text-text-primary block"
                    onClick={() => startEdit(task.id, 'due_date', task.due_date || '')}
                  >
                    {formatShortDate(task.due_date) || '—'}
                  </span>
                )}
              </div>

              {/* Created date */}
              <div className="px-1 hidden md:block">
                <span className="text-xs text-text-muted block">
                  {formatShortDate(task.created_date) || '—'}
                </span>
              </div>

              {/* Delete */}
              <div className="flex justify-center">
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent-red"
                  title="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {filteredTodo.length === 0 && (
            <div className="py-3 text-center text-sm text-text-muted">
              {searchText ? 'No matching pending tasks' : 'No pending tasks'}
            </div>
          )}
        </div>

        {/* Add row */}
        <div className="flex items-center gap-2 py-3 mt-1 border-t border-border">
          <input
            ref={addTextRef}
            value={addText}
            onChange={e => setAddText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && addText.trim()) { e.preventDefault(); addTask(); }
              if (e.key === 'Tab' && !e.shiftKey && addText.trim()) {
                e.preventDefault();
                addClassRef.current?.focus();
              }
            }}
            placeholder="Add a task..."
            className="flex-1 min-w-0 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent placeholder:text-text-muted"
          />

          <div className="relative hidden md:block">
            <input
              ref={addClassRef}
              value={addClassDisplay}
              onChange={e => {
                setAddClassDisplay(e.target.value);
                setAddClassId(undefined);
                setClassHighlight(-1);
                if (!showClassDropdown) setShowClassDropdown('add');
              }}
              onFocus={() => { setShowClassDropdown('add'); setClassHighlight(-1); }}
              onBlur={() => { setTimeout(() => { resolveAddClass(); }, 150); }}
              onKeyDown={handleClassKeyDown}
              placeholder="Class"
              className="w-28 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent placeholder:text-text-muted"
            />
            {showClassDropdown === 'add' && (
              <ClassDropdown
                classes={getFilteredClasses()}
                highlightIndex={classHighlight}
                onSelect={(cid) => setClassForTask('add', cid)}
                onClose={() => { setShowClassDropdown(null); setClassHighlight(-1); }}
              />
            )}
          </div>

          <div className="relative">
            <input
              ref={addDueRef}
              value={addDueInput}
              onChange={e => { setAddDueInput(e.target.value); setAddDueResolved(''); }}
              onBlur={resolveDueDate}
              onKeyDown={e => {
                if (e.key === 'Enter' && addText.trim()) { e.preventDefault(); resolveDueDate(); addTask(); }
                if (e.key === 'Tab') { resolveDueDate(); }
              }}
              placeholder="Due date"
              className="w-24 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent placeholder:text-text-muted pr-7"
            />
            <input
              ref={addDatePickerRef}
              type="date"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 opacity-0 cursor-pointer"
              onChange={e => {
                const val = e.target.value;
                if (val) {
                  setAddDueResolved(val);
                  setAddDueInput(formatShortDate(val) || val);
                }
              }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              <Calendar size={14} />
            </span>
          </div>

          <button
            onClick={addTask}
            disabled={!addText.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0 ${
              addText.trim()
                ? 'bg-accent text-bg-primary hover:brightness-110'
                : 'bg-bg-input text-text-muted cursor-not-allowed'
            }`}
          >
            Add
          </button>
        </div>
      </div>

      {/* Completed section */}
      <div className="rounded-xl bg-bg-card border border-border p-5">
        <button
          onClick={() => setShowDone(!showDone)}
          className="text-sm text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
        >
          {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Completed ({filteredDone.length})
        </button>

        {showDone && filteredDone.length > 0 && (
          <div className="mt-2 space-y-0">
            {/* Table header for completed */}
            <div className="grid grid-cols-[28px_1fr_80px_28px] md:grid-cols-[28px_1fr_90px_80px_80px_28px] gap-0 border-b border-border pb-1.5 mb-1">
              <div></div>
              <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1">Task</div>
              <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1 hidden md:block">Class</div>
              <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1">Due</div>
              <div className="text-[0.6rem] text-text-muted uppercase tracking-wider px-1 hidden md:block">Created</div>
              <div></div>
            </div>

            {filteredDone.map(task => (
              <div
                key={task.id}
                className="grid grid-cols-[28px_1fr_80px_28px] md:grid-cols-[28px_1fr_90px_80px_80px_28px] gap-0 items-center group py-1 border-b border-border/20"
              >
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleTask(task.id, false)}
                    className="w-4 h-4 rounded bg-accent-green/20 border border-accent-green flex items-center justify-center text-accent-green"
                  >
                    <Check size={10} />
                  </button>
                </div>
                <div className="px-1">
                  <span className="text-sm text-text-muted line-through truncate block">{task.text}</span>
                </div>
                <div className="px-1 hidden md:block">
                  <span className="text-xs text-text-muted">{getClassName(task.class_id)}</span>
                </div>
                <div className="px-1">
                  <span className="text-xs text-text-muted">{formatShortDate(task.due_date) || '—'}</span>
                </div>
                <div className="px-1 hidden md:block">
                  <span className="text-xs text-text-muted">{formatShortDate(task.created_date) || '—'}</span>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent-red"
                    title="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showDone && filteredDone.length === 0 && (
          <div className="mt-2 py-3 text-center text-sm text-text-muted">
            {searchText ? 'No matching completed tasks' : 'No completed tasks'}
          </div>
        )}
      </div>
    </div>
  );
}

// Class dropdown sub-component
function ClassDropdown({
  classes,
  highlightIndex,
  onSelect,
  onClose,
}: {
  classes: ClassInfo[];
  highlightIndex: number;
  onSelect: (classId: number | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const allOptions = [{ id: null as number | null, name: 'General' }, ...classes];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  useEffect(() => {
    if (highlightIndex >= 0 && ref.current) {
      const items = ref.current.querySelectorAll('[data-class-item]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-1 w-44 bg-bg-card border border-border rounded-lg shadow-lg overflow-hidden"
    >
      <div className="max-h-48 overflow-y-auto py-1">
        {allOptions.map((opt, i) => (
          <button
            key={opt.id ?? 'general'}
            data-class-item
            onMouseDown={(e) => { e.preventDefault(); onSelect(opt.id); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              i === highlightIndex
                ? 'bg-accent/20 text-text-primary font-medium'
                : 'text-text-secondary hover:bg-hover'
            }`}
          >
            {opt.name}
          </button>
        ))}
      </div>
    </div>
  );
}
