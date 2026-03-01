'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const authError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(authError === 'auth_failed' ? 'Authentication failed. Please try again.' : '');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const supabase = createSupabaseBrowser();

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess('Check your email for a confirmation link. Once confirmed, you can log in.');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-accent mb-2">TeacherDash</h1>
        <p className="text-text-secondary text-sm">
          {isSignUp ? 'Create your account' : 'Sign in to your dashboard'}
        </p>
      </div>

      {/* Card */}
      <div className="rounded-xl bg-bg-card border border-border p-6 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-accent font-semibold mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@school.edu"
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-accent font-semibold mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isSignUp ? 'Choose a password (min. 6 characters)' : 'Enter your password'}
              required
              minLength={6}
              className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="px-3 py-2 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (isSignUp ? 'Creating account...' : 'Signing in...')
              : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccess('');
            }}
            className="text-sm text-text-secondary hover:text-accent transition-colors"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-text-muted text-xs mt-6">
        Your daily teaching command center
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-accent mb-2">TeacherDash</h1>
          <p className="text-text-secondary text-sm">Loading...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
