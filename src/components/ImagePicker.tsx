'use client';

import { useState, useRef, useCallback } from 'react';

type Mode = 'default' | 'search' | 'generate' | 'library';

interface ImagePickerProps {
  slot: number;
  currentImage: string | null;
  onImageSelected: (file: File) => void;
  onImageUrl: (url: string) => void;
  onRemoveImage: () => void;
  date: string;
}

export default function ImagePicker({
  slot,
  currentImage,
  onImageSelected,
  onImageUrl,
  onRemoveImage,
  date,
}: ImagePickerProps) {
  const [mode, setMode] = useState<Mode>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: number; preview: string; web: string; tags: string }[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [genTopic, setGenTopic] = useState('');
  const [genPrompt, setGenPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [libraryImages, setLibraryImages] = useState<
    { name: string; url: string }[]
  >([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) onImageSelected(file);
          return;
        }
      }
    },
    [onImageSelected]
  );

  async function doSearch(page = 1) {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bellringers/search-images?q=${encodeURIComponent(searchQuery.trim())}&page=${page}`
      );
      const data = await res.json();
      if (res.ok) {
        if (page === 1) {
          setSearchResults(data.results);
        } else {
          setSearchResults((prev) => [...prev, ...data.results]);
        }
        setSearchPage(page);
        setHasMore(data.hasMore ?? false);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch {
      setError('Search failed — check your connection');
    } finally {
      setSearchLoading(false);
    }
  }

  async function selectSearchImage(result: { id: number; web: string }) {
    setDownloading(result.id);
    setError(null);
    try {
      const res = await fetch('/api/bellringers/download-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: result.web, date, slot }),
      });
      const data = await res.json();
      if (res.ok && data.path) {
        onImageUrl(data.path);
        setMode('default');
      } else {
        setError(data.error || 'Failed to download image');
      }
    } catch {
      setError('Failed to download image');
    } finally {
      setDownloading(null);
    }
  }

  async function doGenerate() {
    if (!genTopic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/bellringers/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: genTopic.trim(),
          date,
          slot,
          generatePrompt: genPrompt,
        }),
      });
      const data = await res.json();
      if (res.ok && data.path) {
        onImageUrl(data.path);
        if (data.prompt) {
          window.dispatchEvent(
            new CustomEvent('bellringer-image-prompt', {
              detail: { slot, prompt: data.prompt },
            })
          );
        }
        setMode('default');
      } else {
        setError(data.error || 'Failed to generate image');
      }
    } catch {
      setError('Failed to generate image — check your connection');
    } finally {
      setGenerating(false);
    }
  }

  async function openLibrary() {
    setMode('library');
    if (libraryImages.length > 0) return;
    setLibraryLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bellringers/images');
      const data = await res.json();
      if (res.ok) {
        setLibraryImages(data.images || []);
      } else {
        setError(data.error || 'Failed to load images');
      }
    } catch {
      setError('Failed to load image library');
    } finally {
      setLibraryLoading(false);
    }
  }

  function selectLibraryImage(img: { url: string }) {
    onImageUrl(img.url);
    setMode('default');
  }

  const btnCls =
    'px-2.5 py-1.5 text-xs rounded-lg font-semibold transition-all';
  const btnActive = `${btnCls} bg-[#4ECDC4] text-[#1a1a2e] hover:brightness-110`;
  const btnMuted = `${btnCls} bg-[#2a3a5c] text-[#a8b2d1] hover:bg-[#344868]`;

  return (
    <div
      className="border border-dashed border-[#2d3f5f] rounded-md p-3 mb-2 hover:border-[#4ECDC4] transition-colors"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onImageSelected(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Current image preview */}
      {currentImage && mode === 'default' && (
        <div className="mb-2 relative group">
          <img
            src={currentImage}
            alt=""
            className="max-w-full max-h-[140px] rounded mx-auto"
          />
          <div className="flex justify-center gap-2 mt-1.5">
            <button
              className={btnMuted}
              onClick={() => fileInputRef.current?.click()}
            >
              Change
            </button>
            <button
              className={`${btnCls} bg-[#3a2030] text-[#e74c3c] hover:bg-[#4a2535]`}
              onClick={onRemoveImage}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!currentImage && mode === 'default' && (
        <div className="text-center text-xs text-[#6c7a96] py-2">
          <p className="mb-1">No image — upload, paste, search, or generate</p>
          <p className="text-[0.65rem] text-[#4a5570]">
            Click or Ctrl+V to paste from clipboard
          </p>
        </div>
      )}

      {/* Action buttons */}
      {mode === 'default' && (
        <div className="flex gap-1.5 flex-wrap justify-center mt-1">
          <button
            className={btnMuted}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </button>
          <button
            className={btnMuted}
            onClick={() => setMode('search')}
          >
            Search
          </button>
          <button
            className={btnMuted}
            onClick={() => setMode('generate')}
          >
            AI Generate
          </button>
          <button
            className={btnMuted}
            onClick={openLibrary}
          >
            Library
          </button>
        </div>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <div>
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doSearch(1);
              }}
              placeholder="Search images..."
              className="flex-1 px-2.5 py-1.5 bg-[#253352] border border-[#2d3f5f] rounded-lg text-white text-xs focus:border-[#4ECDC4] focus:outline-none"
              autoFocus
            />
            <button
              className={btnActive}
              onClick={() => doSearch(1)}
              disabled={searchLoading}
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
            <button className={btnMuted} onClick={() => setMode('default')}>
              Cancel
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto">
              {searchResults.map((r, idx) => (
                <button
                  key={`${r.id}-${idx}`}
                  className="relative rounded overflow-hidden border border-[#2d3f5f] hover:border-[#4ECDC4] transition-colors group"
                  onClick={() => selectSearchImage(r)}
                  disabled={downloading === r.id}
                  title={r.tags}
                >
                  <img
                    src={r.preview}
                    alt={r.tags}
                    className="w-full h-[60px] object-cover"
                  />
                  {downloading === r.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="inline-block w-4 h-4 border-2 border-[#2d3f5f] border-t-[#4ECDC4] rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {hasMore && searchResults.length > 0 && (
            <button
              className={`${btnMuted} mt-1.5 w-full`}
              onClick={() => doSearch(searchPage + 1)}
              disabled={searchLoading}
            >
              Load More
            </button>
          )}
        </div>
      )}

      {/* Generate mode */}
      {mode === 'generate' && (
        <div>
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doGenerate();
              }}
              placeholder="Describe the image to generate..."
              className="flex-1 px-2.5 py-1.5 bg-[#253352] border border-[#2d3f5f] rounded-lg text-white text-xs focus:border-[#4ECDC4] focus:outline-none"
              autoFocus
            />
            <button
              className={btnActive}
              onClick={doGenerate}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
            <button className={btnMuted} onClick={() => setMode('default')}>
              Cancel
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[#a8b2d1] cursor-pointer">
            <input
              type="checkbox"
              checked={genPrompt}
              onChange={(e) => setGenPrompt(e.target.checked)}
              className="accent-[#4ECDC4]"
            />
            Also generate a writing prompt for this image
          </label>
          {generating && (
            <div className="text-center text-xs text-[#6c7a96] mt-2">
              <span className="inline-block w-4 h-4 border-2 border-[#2d3f5f] border-t-[#4ECDC4] rounded-full animate-spin mr-1 align-middle" />
              Creating image with AI...
            </div>
          )}
        </div>
      )}

      {/* Library mode */}
      {mode === 'library' && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#a8b2d1] font-semibold">My Images</span>
            <button className={btnMuted} onClick={() => setMode('default')}>
              Cancel
            </button>
          </div>

          {libraryLoading ? (
            <div className="text-center text-xs text-[#6c7a96] py-4">
              <span className="inline-block w-4 h-4 border-2 border-[#2d3f5f] border-t-[#4ECDC4] rounded-full animate-spin mr-1 align-middle" />
              Loading...
            </div>
          ) : libraryImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto">
              {libraryImages.map((img) => (
                <button
                  key={img.name}
                  className="rounded overflow-hidden border border-[#2d3f5f] hover:border-[#4ECDC4] transition-colors"
                  onClick={() => selectLibraryImage(img)}
                  title={img.name}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-[60px] object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-[#6c7a96] py-4">
              No images yet. Upload or generate some first.
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-1.5 px-2.5 py-1.5 bg-[#3a2030] border border-[#e74c3c]/30 rounded-lg text-xs text-[#e74c3c]">
          {error}
        </div>
      )}
    </div>
  );
}
