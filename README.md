# Solamentis

Solamentis is a provider-independent AI creative application built with Next.js, React, Supabase, private Storage, durable generation jobs, configurable AI routing, safety checks, credits, and Stripe billing.

## Current architecture

```text
Browser
  -> Next.js app + authenticated API routes
  -> Supabase Auth
  -> ownership / plan / rate-limit validation
  -> safety policy gate
  -> credit reservation + idempotency
  -> generation_jobs
  -> Supabase queue
  -> protected worker bridge
  -> configured provider/model
  -> moderation + processing
  -> private Supabase Storage
  -> generation_outputs + History
  -> credit finalize/refund

Billing
  Browser -> /api/billing/checkout -> Stripe Checkout
  Stripe  -> Supabase Edge Function billing-webhook
          -> verified billing event
          -> subscription / transaction / credit grant updates
```

The application currently uses Node.js runtime for the Next.js API routes because image processing, Sharp, FFmpeg/video processing, and the existing worker are Node-oriented. The Supabase `generation-worker` Edge Function is a protected bridge into the Next.js worker endpoint; it is not yet a fully Edge-native media-processing worker.

## Repository

GitHub: `https://github.com/WorkRCS/solamentis`

Main branch is `main`.

## Stack

- Next.js 16 / React 19
- TypeScript
- Supabase Auth, PostgreSQL, Storage, RPCs and Queue
- Google Gemini for configured image generation and image analysis routes
- Fal.ai / Kling for configured video generation
- Stripe Checkout + signed webhook processing
- Sharp and FFmpeg-based media processing
- GitHub Actions CI

Node.js 22+ is required by the project configuration.

## API surface

The repository contains 21 Next.js API route files under `src/app/api`.

| Route | Methods | Purpose |
|---|---|---|
| `/api/health` | GET | Application health endpoint |
| `/api/auth/signout` | POST | Sign out and write activity/audit information |
| `/api/profile` | GET, PATCH | Load/update the authenticated profile and activity |
| `/api/media-usage` | GET | Live plan, credits, upload limits and media capabilities |
| `/api/projects` | GET, POST | List and create owned creative workspaces |
| `/api/projects/:projectId` | GET, PATCH, DELETE | Read, edit and safely delete an owned workspace |
| `/api/assets/:assetId/signed-url` | GET | Issue a short-lived private asset URL |
| `/api/uploads/sign` | POST | Validate upload size/plan limits and issue a signed upload URL |
| `/api/uploads/complete` | POST | Validate, moderate, compress and persist an uploaded image |
| `/api/generate` | POST | Validate and enqueue an image-generation job |
| `/api/generate/:jobId` | GET | Read an owned image-generation job and signed outputs |
| `/api/analyze-image` | POST | Run configured image authenticity analysis and persist results |
| `/api/video-ad` | POST | Validate and enqueue a silent video generation job |
| `/api/video-ad/:jobId` | GET | Read an owned video job and signed master/preview outputs |
| `/api/history/:jobId` | GET, DELETE | Read or delete owned generation history and assets |
| `/api/history/:jobId/download` | GET | Download an owned master output |
| `/api/billing/checkout` | POST | Build server-validated Stripe plan/credit-pack Checkout sessions |
| `/api/admin/providers/:providerId` | GET, PATCH | Admin-only provider configuration and secret rotation |
| `/api/admin/routes/:planId/:quality` | PATCH | Admin-only AI feature routing configuration |
| `/api/internal/generation-worker` | POST | Protected server-to-server worker execution endpoint |
| `/api/internal/provider-health` | POST | Protected provider/model health checks |

All user-facing API routes authenticate with Supabase Auth before reading or changing user-owned data. Internal routes use server-side secrets and are not browser APIs.

## Supabase

Current production project:

- Project ref: `yyeidanzflitrstvooxw`
- URL: `https://yyeidanzflitrstvooxw.supabase.co`
- Region: `ap-southeast-1`
- PostgreSQL: 17.x
- Storage bucket: `solamentis-assets`
- Storage bucket is private.

The live database contains the application schema, RLS policies, ownership checks, credit ledger/reservation functions, idempotency guards, provider routing, pricing, safety events, billing records, and private runtime secret storage.

`schema.sql` is the repository's structural schema snapshot. Ordered files in `supabase/migrations/` are authoritative for exact live DDL, policy, function, trigger and data changes.

## Environment variables

Do **not** create or commit a real `.env` file in GitHub. The repository intentionally ignores `.env`, `.env.local`, and other local secret files.

Use `.env.example` as the template, then create `.env.local` for the Next.js application on your machine or configure the same variables in the deployment platform.

### Next.js application variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://yyeidanzflitrstvooxw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_SECRET_KEY=<server-only Supabase secret key>
NEXT_PUBLIC_APP_URL=https://<your-real-production-domain>
GOOGLE_AI_API_KEY=<Google AI API key>
FAL_KEY=<Fal.ai key>
CRON_SECRET=<long random secret>
SOLAMENTIS_PROVENANCE_SECRET=<long random secret>
STRIPE_SECRET_KEY=<Stripe secret key>
STRIPE_WEBHOOK_SECRET=<Stripe webhook signing secret>
```

Never expose `SUPABASE_SECRET_KEY`, provider keys, Stripe secret keys, webhook secrets, `CRON_SECRET`, or provenance secrets to client-side code.

### Supabase Edge Function variables

The `generation-worker` Edge Function uses Supabase's injected `SUPABASE_URL` plus `SUPABASE_SECRET_KEY`, and also requires:

```env
SOLAMENTIS_APP_URL=https://<your-real-production-domain>
```

`SOLAMENTIS_APP_URL` points the Edge worker bridge back to the deployed Next.js application. It is a server-side/Edge secret, not a browser variable.

`billing-webhook` and the other Edge Functions have their own server-side configuration. Do not copy provider credentials into browser-exposed `NEXT_PUBLIC_*` variables.

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in real values in .env.local
npm run lint
npm run typecheck
npm run build
npm run dev
```

The app runs through the normal Next.js development server. There is intentionally no manual `npm run worker` script; generation work is dispatched through the protected queue/worker architecture.

## Production API rules

The API layer is designed around the following invariants:

1. Authenticate every browser request with Supabase Auth.
2. Check ownership using the authenticated user ID before accessing projects, assets, jobs, billing records, or history.
3. Keep private Storage private and return short-lived signed URLs only after authorization.
4. Reserve and finalize/refund credits transactionally through database RPCs.
5. Use idempotency keys on generation and payment-related operations to prevent duplicate actions.
6. Resolve AI provider/model routing from Supabase rather than trusting browser-supplied provider choices.
7. Apply safety checks before generation and moderation before delivering generated/uploaded media.
8. Keep internal worker/health endpoints behind server-only secrets.
9. Never return provider API keys, Supabase secret keys, runtime secrets, or Stripe secrets to the browser.

## Current provider routing

The runtime uses `ai_feature_routes` as the source of truth for feature routing by plan, category, and quality. Providers are stored in `ai_providers`; models are stored in `ai_models`.

Current configured protocols include:

- `google_gemini` for image generation and image analysis
- `fal_video` for silent video generation

The admin routing UI/API now reads and updates the same `ai_feature_routes` table used by the runtime.

## Storage and media behavior

Uploads are compressed before persistent storage. The storage bucket accepts the application media types required by the current product, including WebP images and MP4 video masters.

Generated media is stored using a master/preview pattern. Browser delivery uses signed URLs rather than public bucket access.

## Billing behavior

The billing page gets regional pricing and active products from Supabase. Checkout requests are revalidated server-side before creating a Stripe Checkout session.

The trusted billing state comes from the verified Stripe webhook, not from a browser redirect. Credit grants, subscriptions, and billing transactions are persisted in Supabase.

## CI

GitHub Actions runs:

```text
npm install --no-audit
npm audit --omit=dev --audit-level=high
npm run lint
npm run typecheck
npm run build
```

Do not treat a running workflow as successful until GitHub reports a completed `success` conclusion.

## Security status

The database has RLS enabled across the application tables, private runtime secret access is denied to client roles, Storage is private, and duplicate/idempotency protections exist across the core generation, billing, credit and workspace flows.

Supabase's current security advisor still reports one external project-level warning: leaked-password protection in Auth is disabled. That setting must be enabled in the Supabase Auth dashboard; it is not controlled by the application schema migrations.

## Known architectural boundary

The Next.js `generation-worker.ts` and `video-ad-worker.ts` remain Node.js workloads because they rely on Sharp/FFmpeg and the existing provider/media-processing stack. The Supabase Edge `generation-worker` function currently authenticates the queue call and bridges it to `/api/internal/generation-worker`.

This means the system is automatic from the queue/trigger perspective, but media processing is not yet 100% Supabase Edge-native. A later architecture pass can move compatible processing into Deno/Edge or another managed worker runtime without changing the browser API contract.

## Source-of-truth rule

For database behavior, `supabase/migrations/` is authoritative.

For structural documentation, `schema.sql` is the canonical snapshot.

For browser/server API contracts, the route files under `src/app/api` are authoritative.

For deployment secrets, use the deployment platform's secret store and Supabase Edge Function secrets. Never commit real credentials.

## Current verification snapshot

The current repository has the API compatibility fixes for video status handling, video storage MIME compatibility, and admin feature routing. The latest checked live Supabase state contains active provider/model configuration and a private storage bucket accepting the current image and video media types.

A complete authenticated production smoke test still requires an actual deployed webapp URL plus valid production credentials/provider keys. The connected Vercel integration currently does not expose a linked project, so deployment HTTP smoke testing cannot be truthfully claimed from this environment.
