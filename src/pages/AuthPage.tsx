import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/Loading';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required'); return; }
    setLoading(true); setError(null);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Invalid login')) setError('Invalid email or password');
      else if (msg.includes('already registered')) setError('This email is already registered. Try signing in.');
      else if (msg.includes('Password should be')) setError('Password must be at least 6 characters');
      else setError(msg || 'Authentication failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-kma-base">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl" style={{ background: 'radial-gradient(circle, #2B9FD4 0%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <img
            src="/901c4dfc-a450-463e-b9d0-69aaed94f9ba.png"
            alt="KMA TOOLS"
            className="h-10 w-auto object-contain mb-3"
            style={{ filter: 'brightness(1.5) contrast(1.15)' }}
          />
          <p className="text-2xs text-zinc-600 font-mono">v6 webhook suite</p>
        </div>

        <div className="panel p-5 animate-slide-up">
          <div className="flex gap-1 p-1 rounded-lg bg-kma-base mb-5">
            <button onClick={() => setMode('signin')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'signin' ? 'bg-accent-bg text-accent-bright border border-accent-border' : 'text-zinc-600 hover:text-steel-dim'}`}>Sign In</button>
            <button onClick={() => setMode('signup')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'signup' ? 'bg-accent-bg text-accent-bright border border-accent-border' : 'text-zinc-600 hover:text-steel-dim'}`}>Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input type="email" className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input type="password" className="input pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            {error && <div className="rounded-md bg-red-500/5 border border-red-500/15 px-3 py-2 text-xs text-red-400">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? <Spinner /> : <ArrowRight className="w-4 h-4" />}{loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button>
          </form>

          <p className="text-2xs text-zinc-600 text-center mt-4">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-accent-bright hover:text-accent font-medium">{mode === 'signin' ? 'Sign up' : 'Sign in'}</button>
          </p>
        </div>

        <p className="text-2xs text-zinc-700 text-center mt-5">Your webhooks, templates, and history are private to your account.</p>
      </div>
    </div>
  );
}
