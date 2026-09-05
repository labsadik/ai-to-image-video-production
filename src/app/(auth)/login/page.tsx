'use client';

import { FormEvent, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : 'Signed in.');
    if (!error) window.location.href = '/dashboard/create';
  }

  return <main className="auth-shell"><form className="card form" onSubmit={submit}><p className="eyebrow">SOLAMENTIS</p><h1>Sign in</h1><input aria-label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" /><input aria-label="Password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" /><button type="submit">Sign in</button>{message && <p className="muted">{message}</p>}<a href="/signup">Create an account</a></form></main>;
}
