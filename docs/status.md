# Solamentis implementation status

## Implemented

- Next.js + TypeScript foundation
- Configuration-driven plans and platform specs
- Live Supabase provider/model routing tables
- Google Gemini image adapter using current image-generation API
- Configuration-driven `generic_json` provider adapter for compatible image APIs
- Provider protocol/base URL/request/response mapping stored in Supabase
- Provider/model/API-key switching through configuration/admin API without rewriting application code for supported protocols
- Runtime route resolution from the captured generation job plan
- Authenticated generation endpoint
- Transactional credit reserve/finalize/refund contracts
- Idempotent generation jobs
- Supabase durable generation queue
- Protected queue worker endpoint and Vercel cron trigger
- Supabase Vault provider-secret fallback
- Signed private upload issuance
- Uploaded-image structural validation
- Private signed download URLs
- Sharp-based preview/editor/export resizing and compression
- Free-plan watermark compositing
- Minimal login/signup/create UI
- Server-side admin provider and AI-route configuration endpoints
- Audit-log writes for provider configuration changes
- CI workflow for lint/typecheck/build
- Supabase RLS/security hardening and foreign-key indexes

## Not yet launch-complete

- Production image moderation/classification for uploaded, reference, and generated images
- Runtime loading and persistence of safety decisions at every pipeline stage
- Provider health/capability discovery with persistent health state and automatic failover
- Full retry/dead-letter operational policy, backoff, and alerting
- Production billing checkout, subscriptions, entitlements, renewals, cancellations, and signed webhook replay protection
- Detector implementation
- Full projects/history/editor/canvas workflows
- Full admin UI for providers, models, routes, safety, plans, users, and audit history
- Rate limits and abuse prevention enforcement
- Observability dashboards, metrics, tracing, alerts, and error tracking
- Comprehensive unit/integration/e2e/security/safety/concurrency test suite
- Production secrets configured and verified
- Vercel/Supabase production deployment and end-to-end smoke test with a real provider key
- Generated master-asset lifecycle/cleanup and complete upload-derivative pipeline
- Cost telemetry, provider spend budgets, and per-feature gross-margin controls
- Backup/PITR restore drill, load/stress testing, and disaster-recovery verification
- Migration from legacy Supabase service-role/anon key names to publishable/secret keys before the end-of-2026 deprecation window

## Important provider rule

The application is provider-independent at the business-logic level. A provider that conforms to an existing runtime protocol can be added or changed by configuration: provider id, protocol, endpoint, credential, request template, response paths, and model routes. A genuinely incompatible protocol still requires one small adapter implementation, but the generation jobs, credits, storage, safety pipeline, editor, and product core do not need to be rewritten.
