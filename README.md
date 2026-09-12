# Solamentis

**Solamentis is a private AI creative studio for making, checking, organizing, and exporting campaign media.**

It gives creators and teams one place to generate images, assess whether an image may be AI-made or edited, create short silent video clips, and keep every result in a project workspace. Credits, subscriptions, private media storage, safety checks, and provider routing are part of the product—not bolted on around a chat box.

> Status: an active Next.js application. The core image, authenticity-analysis, workspace, history, credit, billing, provider-routing, and worker flows are implemented. A full canvas editor, templates, and brand kits are planned rather than available today.

## What Solamentis does

| Need | What Solamentis does |
| --- | --- |
| Create visual ideas | Generate an image from a prompt at a chosen quality and platform canvas size. |
| Check an image | Analyze an uploaded image for likely AI generation, digital editing, compositing, provenance clues, and visual artifacts. |
| Make a motion asset | Create a short, silent 5–10 second video clip. |
| Keep work organized | Create workspaces for clients, campaigns, products, or personal projects; link assets and history to each one. |
| Find work later | Browse private image, video, and analysis history, preview assets, and download authorized master files. |
| Stay in control of spend | See monthly and purchased credits, upload limits, subscriptions, regional pricing, and payment history. |

## Product tour

### 1. A single creative home

The dashboard shows the active workspace, available credits, and shortcuts into the Media Studio. A user can begin from a prompt, inspect an image, or start a silent-video job.

![Solamentis dashboard: creative studio workspace, wallet, and quick actions](https://ik.imagekit.io/xvqovhmcyr/Solamentis%20_%20AI%20Creative%20Studio%20-%20Google%20Chrome%209_12_2026%2012_22_50%20PM.png)

### 2. Workspaces keep a campaign together

Projects are creative workspaces, not just folders. Each can have its own name, colour, icon, platform canvas, history, and assets. Use one for a client, campaign, product launch, or personal idea.

![Solamentis projects screen: workspace cards, history, and asset counts](https://ik.imagekit.io/xvqovhmcyr/Solamentis%20_%20AI%20Creative%20Studio%20-%20Google%20Chrome%209_12_2026%2012_23_05%20PM.png)

### 3. Every result has a private history

Generated images, analysis results, and videos appear together in history. Users can view all work or narrow it to a single workspace, so creative decisions remain traceable instead of disappearing into isolated conversations.

![Solamentis media history: images, analyses, videos, and project filter](https://ik.imagekit.io/xvqovhmcyr/Solamentis%20_%20AI%20Creative%20Studio%20-%20Google%20Chrome%209_12_2026%2012_23_41%20PM.png)

### 4. Create or verify media from one studio

The Media Studio supports three modes:

- **Image** — prompt-based image generation, with workspace and quality selection.
- **Analysis** — upload an image and receive an authenticity assessment with confidence, possible evidence, likely editing tools, and limitations.
- **Video** — generate a silent video clip for supported plans.

Before a job runs, the interface exposes its credit cost. The server independently validates the request, reserves the credits, and finalizes or refunds them based on the outcome.

![Solamentis Media Studio: image, analysis, video modes and analysis result](https://ik.imagekit.io/xvqovhmcyr/Solamentis%20_%20AI%20Creative%20Studio%20-%20Google%20Chrome%209_12_2026%2012_24_12%20PM.png)

### 5. Plans and credits are visible, not mysterious

Solamentis uses a credit wallet. Monthly credits come with the subscription; purchased add-on credits are stored separately. Users can compare plans, see regional prices, buy credits through Stripe Checkout, and review verified billing history.

| Plan shown in the product | Monthly credits | Upload allowance | Watermark | Available creative tools |
| --- | ---: | ---: | --- | --- |
| Free | 5 | 2 images / month and project | Yes | Preview images and Basic analysis |
| Starter (`pro`) | 50 | 5 images / month and project | No | Preview, Standard, Premium images; all analysis levels; silent video |
| Growth (`business`) | 100 | 20 images / month and project | No | Same current creative tools as Starter, with higher capacity |

Plan prices are supplied from the server for the user’s billing country, so this table deliberately does not hard-code an amount or currency.

![Solamentis billing: Free, Starter, and Growth plans](https://ik.imagekit.io/xvqovhmcyr/Solamentis%20_%20AI%20Creative%20Studio%20-%20Google%20Chrome%209_12_2026%2012_24_25%20PM.png)

### 6. Profile and plan status stay together

The settings area lets a user manage their profile and see their current plan, credit balance, expiry information, and capabilities without leaving the studio.

![Solamentis settings: profile information and current plan summary](https://ik.imagekit.io/xvqovhmcyr/Solamentis%20_%20AI%20Creative%20Studio%20-%20Google%20Chrome%209_12_2026%2012_24_40%20PM.png)

## Supported canvases and creative limits

Workspaces and image generation support ready-made canvas presets for YouTube thumbnails, Instagram posts and stories, Facebook posts and covers, Pinterest pins, LinkedIn posts, X posts, ad creative, posters, and website banners. A workspace can alternatively use a custom canvas.

| Quality in the UI | Runtime tier | Credit cost |
| --- | --- | ---: |
| Basic | Preview | 1 |
| Medium | Standard | 5 |
| Ultra | Premium | 10 |

Image analysis costs 2, 5, or 10 credits for Basic, Medium, or Hard respectively. Silent video is currently audio-free, supports 5–10 seconds, and is processed as a Node-based media job; its exact credit cost is returned by the live usage endpoint.

## How it works

```text
Creator
  │  selects a workspace, mode, canvas, quality, and prompt or image
  ▼
Next.js application + authenticated API
  │  checks ownership, plan, quota, rate limit, safety, and idempotency
  ▼
Supabase
  │  reserves credits and records a durable generation job
  ▼
Protected queue / worker bridge
  │  resolves the approved provider and model from server configuration
  ▼
AI provider + media processing
  │  applies moderation, previews, compression, and plan watermarking
  ▼
Private Supabase Storage + History
  │  serves short-lived signed URLs only after authorization
  ▼
Creator sees the result, its status, and the final credit outcome
```

### Provider configuration

The browser never chooses an arbitrary provider or sends an API key. The server resolves feature routes from Supabase configuration by plan, feature category, and quality. The current code includes adapters or protocols for Google Gemini image work, Pixazo image generation, Groq vision analysis, and Fal/Kling-compatible silent-video routes. Provider health checks and fallback configuration support operations without changing the browser contract.

## Technical architecture

- **App:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Identity and data:** Supabase Auth, PostgreSQL, Row Level Security (RLS), Storage, RPCs, queues, and Edge Functions
- **Media:** Sharp for image optimization/watermarks and FFmpeg for video processing
- **Payments:** Stripe Checkout plus signed, replay-safe webhook handling
- **Delivery:** private storage with short-lived signed asset URLs; no public media bucket is required
- **Automation:** GitHub Actions runs dependency audit, linting, type checking, and a production build

The Next.js worker remains a Node.js workload because its processing pipeline uses Sharp and FFmpeg. The Supabase `generation-worker` Edge Function securely bridges queued work into that worker; it is not presented as a fully Edge-native video processor.

## Security and reliability

- Authenticated requests are scoped to the current Supabase user.
- Server routes verify workspace, job, asset, history, and billing ownership before access.
- Storage is private; authorized users receive short-lived signed URLs rather than permanent public URLs.
- Credits are reserved, finalized, or refunded transactionally. Idempotency keys help prevent duplicate generation and payment effects.
- Prompt safety checks run before generation. Uploads and generated output are moderated; blocked or review-required assets cannot receive signed download URLs.
- Provider keys, Stripe secrets, Supabase server credentials, webhook secrets, and internal worker secrets remain server-side.
- Billing becomes trusted only after the verified Stripe webhook is processed—not because the browser returns from Checkout.

## Repository map

| Location | Purpose |
| --- | --- |
| `src/app` | App Router pages, authenticated dashboard, marketing pages, and API routes |
| `src/components` | Workspace, studio, history, wallet, billing, upload, and UI components |
| `src/server` | Authorization, generation pipeline, provider configuration, media processing, safety, and rate limits |
| `src/core` and `core` | Provider adapters, job types, and AI domain logic |
| `src/config` | Plans, platform canvases, media features, safety policy, and provider catalog |
| `supabase/migrations` | Ordered, authoritative database, RLS, function, trigger, and data migrations |
| `supabase/functions` | Edge Functions for health, pricing, moderation, provider health, the generation bridge, and Stripe webhooks |
| `workers` | Node-oriented image and video generation worker entry points |
| `schema.sql` | Structural database-schema snapshot |

## API overview

| Area | Routes |
| --- | --- |
| Account and usage | `GET/PATCH /api/profile`, `GET /api/media-usage`, `POST /api/auth/signout` |
| Workspaces | `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:projectId` |
| Uploads and assets | `POST /api/uploads/sign`, `POST /api/uploads/complete`, `GET /api/assets/:assetId/signed-url` |
| Creative work | `POST /api/generate`, `GET /api/generate/:jobId`, `POST /api/analyze-image`, `POST /api/video-ad`, `GET /api/video-ad/:jobId` |
| History | `GET/DELETE /api/history/:jobId`, `GET /api/history/:jobId/download` |
| Billing | `POST /api/billing/checkout` |
| Operations | `GET /api/health`, protected generation-worker and provider-health routes |
| Administration | Admin-only provider configuration and AI-route configuration endpoints |

## Run locally

### Requirements

- Node.js 22 or newer
- A Supabase project with the repository migrations applied
- Server-side credentials for the providers and Stripe features you intend to enable

### Install and start

```bash
npm install
cp .env.example .env.local
# Add real values to .env.local. Never commit it.
npm run lint
npm run typecheck
npm run build
npm run dev
```

Open the development URL reported by Next.js, usually `http://localhost:3000`.

There is intentionally no manual `npm run worker` command. Generation is dispatched through the protected queue-and-worker architecture.

### Environment variables

Start from [`.env.example`](.env.example). At minimum, configure the Supabase URL and publishable key, a server-only Supabase secret, an application URL, the AI provider keys you use, internal worker/provenance secrets, and Stripe keys if billing is enabled.

Never expose a server secret through a `NEXT_PUBLIC_*` value. Do not commit `.env`, `.env.local`, or deployed secret values.

## Database and deployment notes

- Treat `supabase/migrations/` as the source of truth for the live schema and security behavior.
- Treat `schema.sql` as a structural snapshot, not a substitute for ordered migrations.
- Configure Edge Function secrets in Supabase and deployment secrets in the hosting platform’s secret store.
- Apply and verify Stripe webhook secrets before accepting paid production traffic.
- Run a complete authenticated smoke test against the deployed application with real provider credentials before launch.

## Current boundaries and planned work

The application intentionally does **not** claim the following as complete today:

- A complete editor/canvas workflow
- Template and brand-kit workflows
- A complete administration interface for plans, users, safety, providers, and audit history
- Full observability dashboards, alerting, and a comprehensive automated test suite
- A fully Edge-native media worker

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

CI runs the same checks, together with a production dependency audit.
