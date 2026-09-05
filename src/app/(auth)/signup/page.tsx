'use client';

import { FormEvent, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { error } = await getSupabaseBrowserClient().auth.signUp({ email, password });
    setMessage(error ? error.message : 'Account created. Check your email if confirmation is enabled.');
  }

  return <main className="auth-shell"><form className="card form" onSubmit={submit}><p className="eyebrow">SOLAMENTIS</p><h1>Create account</h1><input aria-label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" /><input aria-label="Password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" /><button type="submit">Create account</button>{message && <p className="muted">{message}</p>}<a href="/login">Back to sign in</a></form></main>;
}
