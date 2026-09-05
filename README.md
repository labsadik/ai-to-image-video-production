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

The active plan/quality route is stored in `ai_plan_routes` in Supabase. Providers and models are stored in `ai_providers` and `ai_models`. The application core calls a stable adapter contract, so routine provider/model changes can be data changes rather than application rewrites. A provider with a genuinely incompatible protocol still requires a new adapter.

## Secrets

Browser configuration uses only the Supabase publishable key. Server secrets must never be committed. Provider credentials can come from server environment variables or Supabase Vault.

## Local checks

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Current implementation status

Implemented now: Next.js foundation, Supabase schema/RLS foundation, live provider/model routing, Google Gemini image adapter, credit reservation/finalization/refund contracts, idempotent job creation, durable generation queue, queue worker endpoint, signed uploads, upload validation, private signed download URLs, deterministic image resizing/compression variants, Free watermark processing, minimal authentication pages, minimal generation UI, CI configuration, and Supabase security/performance hardening.

Still required before calling the service fully production-ready: deployed runtime secrets, an actual end-to-end generation test with a valid provider credential, production-grade image moderation for uploaded/generated images, full billing/webhook lifecycle, detector implementation, richer editor/project UX, abuse/rate-limit enforcement, observability, comprehensive automated test suites, and production deployment verification.
