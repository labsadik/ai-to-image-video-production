export default function Home() {
  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">SOLAMENTIS</p>
        <h1>AI image generation, built around configuration.</h1>
        <p className="muted">The core is provider-independent. Models, plans, credits, safety policy, and limits are configuration-driven.</p>
        <div className="grid">
          <div><strong>Provider router</strong><span>One internal generation contract.</span></div>
          <div><strong>Job pipeline</strong><span>Queue-safe, idempotent processing.</span></div>
          <div><strong>Supabase</strong><span>Auth, database, storage, and policy.</span></div>
        </div>
      </section>
    </main>
  );
}
