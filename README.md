# Solamentis

Provider-independent AI image generation SaaS built around configuration, queues, safety boundaries, credits, and private storage.

## Runtime

```text
Next.js
  -> Auth / entitlement / validation
  -> safety gate
  -> transactional credit reservation
  -> idempotent generation job
  -> Supabase Queue
  -> provider/model router
  -> provider adapter
  -> generated image
  -> watermark + resize + compression variants
  -> private Storage
  -> output persistence
  -> credit finalize/refund
```

## Provider switching

The active plan/quality route is stored in `ai_plan_routes` in Supabase. Providers and models are stored in `ai_providers` and `ai_models`. The application core calls a stable adapter contract, so routine provider/model routing changes can be data changes rather than application rewrites. A provider with a genuinely incompatible protocol still requires a new adapter.

## Secrets

Browser configuration uses only the Supabase publishable key. Server secrets must never be committed. Provider credentials can come from server environment variables or Supabase Vault.

## Local checks

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Implemented in the repository

Next.js foundation; Supabase schema and RLS foundation; live provider/model routing; Google Gemini adapter; credit reservation/finalization/refund; idempotent job creation; durable generation queue; protected queue worker endpoint; signed upload issuance; upload validation; private signed download URLs; deterministic resizing/compression variants; Free watermark processing; minimal auth pages; minimal create UI; CI configuration; and Supabase security/performance hardening.

## Before production launch

A production launch still requires: configuring/deploying secrets, a real end-to-end generation test with a valid provider credential, production-grade image moderation for uploads and generated outputs, retry/dead-letter policy testing, full billing and webhook lifecycle, detector implementation, richer editor/project UX, rate-limit and abuse controls, observability/alerts, comprehensive automated tests, and final Vercel/Supabase deployment verification.
