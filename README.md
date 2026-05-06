# PRIZM

Trust-first, SOC 2-oriented bank statement converter for accountants and bookkeepers.

The alpha implementation is hardening 24-hour deletion evidence, audit-on-write coverage, and multi-tenant workspace controls before production launch.

## Status

Phase 1 (Trust-Native MVP) under construction. Wave 0 scaffold and Wave 1 connector layer are complete. Wave 2 server actions and auth land next.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4
- Supabase Auth + Postgres with RLS
- AWS S3 (uploads, 24h lifecycle delete) + Textract (OCR) + KMS (CMK)
- Stripe Checkout + Customer Portal + signed webhooks
- Resend (email) + Sentry (errors) + Upstash Redis (rate limit + idempotency)
- Hosted on Vercel
- pnpm 10 as package manager

## Bring up on a fresh machine

The fastest path: clone, install, fill `.env.local`, then ask Claude Code to set up the rest.

### 1. Clone and install

```bash
git clone https://github.com/PLKNoko/prizm.git
cd prizm
pnpm install
```

If `pnpm` is missing: `npm install -g pnpm@10` first.

### 2. Fill `.env.local`

```bash
cp .env.example .env.local
```

Open `.env.local` and fill the values. The file documents what each one needs. Sandbox-safe values (Supabase URL, Stripe price IDs) are already baked in. The rest are secrets you keep elsewhere (Vercel env, password manager, or whatever the team uses).

Minimum to run `pnpm dev`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (sandbox `sk_test_...`)

### 3. Verify

```bash
pnpm verify       # format + lint + typecheck + unit tests + build
pnpm verify:full  # verify + Playwright + live connector smoke tests
pnpm dev          # http://localhost:3030
curl http://localhost:3030/api/health   # public shallow connector check
```

### 4. Hand off to Claude Code (optional)

Open this directory in Claude Code and ask:

> Set up PRIZM. Read README.md, CLAUDE.md, and docs/specs/wave-0-provisioning-step-by-step.md, then walk me through what is missing on this machine.

Claude reads the project memory and onboarding doc, asks you about MCP connectors and AWS credentials, and provisions whatever the home machine is missing.

## External services

PRIZM depends on six external accounts. Provisioning details live in `docs/specs/wave-0-provisioning-step-by-step.md`.

| Service       | Status                                          | Notes                                                              |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Cloudflare    | Domain `prizmview.app` registered               | Zone import file at `infra/cloudflare/prizmview-app.zone`          |
| Supabase      | Project `dcirauvtuvvokvcwczft` (us-east-1) live | Migration 0001 applied. RLS on all 8 tables.                       |
| Stripe        | Sandbox account `acct_1TRZFv44hvL1QSxT`         | 4 products + 4 subscription prices created. Overage meter pending. |
| Resend        | Account exists                                  | Domain DKIM pending DNS import                                     |
| Upstash Redis | DB `close-stag-109648` (us-east-1)              | Rate limit + idempotency                                           |
| AWS           | Pending                                         | S3, Textract, KMS to be provisioned via aws-api MCP                |

## Layout

```
prizm/
├── app/                            # Next.js App Router
│   ├── (marketing)/                # public pages (landing, pricing, security, etc.)
│   ├── (dashboard)/                # authenticated app
│   ├── (auth)/                     # login + register
│   └── api/                        # route handlers (health, status, v1, webhooks)
├── components/                     # ui, marketing, dashboard
├── lib/
│   ├── server/                     # server-only connectors and helpers
│   ├── shared/                     # iso (db-types, env)
│   └── client/                     # browser-only utilities
├── content/                        # MDX for docs, security, privacy
├── public/.well-known/             # security.txt + privacy-manifest.json
├── supabase/migrations/            # sequential SQL migrations
├── infra/cloudflare/               # BIND zone file for DNS import
├── tests/{unit,integration,e2e}/
├── docs/
│   ├── adr/                        # architecture decision records (8 entries)
│   └── specs/                      # provisioning + wave specs
├── scripts/                        # local utility scripts (seed-stripe, etc.)
└── .github/workflows/              # CI
```

## Common commands

```bash
pnpm dev                # next dev (Turbopack)
pnpm build              # next build
pnpm start              # production server

pnpm lint               # eslint
pnpm format             # prettier --write .
pnpm format:check       # prettier --check .
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run
pnpm test:watch         # vitest interactive
pnpm test:coverage      # vitest with v8 coverage
pnpm test:e2e           # playwright
pnpm test:connectors:live
                         # live connector smoke tests; requires LIVE_CONNECTOR_SMOKE=1
pnpm verify             # format:check + lint + typecheck + test + build (CI gate)
pnpm verify:full        # verify + Playwright + live connector smoke tests

pnpm seed:stripe        # idempotent Stripe sandbox provisioning
                        # requires STRIPE_SECRET_KEY in .env.local
                        # creates products, prices, billing meter, metered overage price
```

## Conventions

- **Karpathy guidelines**: minimum that solves the problem, surgical changes, verifiable success criteria. See `docs/adr/`.
- **Writing protocol**: short sentences, active voice, no em dashes, no semicolons in prose, banned word list. See `CLAUDE.md`.
- **Every architecture decision goes through an ADR**. `docs/adr/000-template.md`.
- **Every server-side action that touches user data writes an audit event**. `lib/server/audit.ts`.
- **Connectors are lazy singletons with a `pingX()` helper** so `/api/health` can introspect them. `lib/server/{supabase,stripe,s3,textract,resend,ratelimit,audit,sentry}.ts`.

## License

Proprietary. All rights reserved until further notice.
