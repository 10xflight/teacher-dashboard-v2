'use client';

import { useEffect } from 'react';

export default function FontSizeProvider() {
  useEffect(() => {
    // Check localStorage first for instant apply, then sync from server
    const cached = localStorage.getItem('app_font_size');
    if (cached) applySize(cached);

    fetch('/api/settings')
      .then(r => r.json())
      .then(settings => {
        const size = settings.app_font_size || 'normal';
        localStorage.setItem('app_font_size', size);
        applySize(size);
      })
      .catch(() => {});
  }, []);

  return null;
}

function applySize(size: string) {
  const html = document.documentElement;
  html.classList.remove('font-size-large', 'font-size-xl');
  if (size === 'large') html.classList.add('font-size-large');
  else if (size === 'xl') html.classList.add('font-size-xl');
}
