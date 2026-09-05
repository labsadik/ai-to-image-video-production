# Solamentis implementation status

## Implemented

- Next.js + TypeScript foundation
- Configuration-driven plans and platform specs
- Live Supabase provider/model routing tables
- Google Gemini image adapter using current image-generation API
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
- CI workflow for lint/typecheck/build
- Supabase RLS/security hardening and foreign-key indexes

## Not yet launch-complete

- Production image moderation/classification for uploaded and generated images
- Automatic moderation decision persistence across every pipeline stage
- Full retry/dead-letter operational policy and alerting
- Production billing checkout, subscriptions, and signed webhook processing
- Detector implementation
- Full projects/history/editor workflows
- Admin configuration UI and audited configuration changes
- Rate limits and abuse prevention enforcement
- Observability dashboards/alerts and error tracking
- Comprehensive unit/integration/e2e/security test suite
- Production secrets configured and verified
- Vercel/Supabase production deployment and end-to-end smoke test with a real provider key
