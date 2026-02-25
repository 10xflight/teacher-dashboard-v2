'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navigation from './Navigation';
import { ToastProvider } from './Toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        {/* Sidebar Navigation */}
        <Navigation
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar for mobile */}
          <header className="lg:hidden flex items-center h-14 px-4 bg-bg-secondary border-b border-border flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Open navigation"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="ml-3 text-base font-semibold text-accent hover:brightness-110 transition-all">
              Teacher Dashboard
            </Link>
          </header>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
