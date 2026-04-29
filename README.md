# PRIZM

Trust-first, SOC 2-ready bank statement converter for accountants and bookkeepers.

This repo holds the SaaS product. Audit history lives one level up at `../runs/`. Project README at `../README.md`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4
- Supabase Auth + Supabase Postgres with RLS
- AWS S3 (uploads + 24h lifecycle delete) + AWS Textract (OCR) + AWS KMS (CMK)
- Stripe Checkout + Customer Portal + signed webhooks
- Resend (transactional email) + Sentry (errors) + Upstash Redis (rate limit + idempotency)
- Hosted on Vercel

## Status

Phase 1 (Trust-Native MVP) under construction. See `docs/specs/` and `docs/adr/`.

## Local development

Prereqs: Node 20+, pnpm 10+, a Supabase project, AWS account, Stripe test account, Resend, Sentry, Upstash. See `docs/specs/wave-0-provisioning-handoff.md`.

```bash
cp .env.example .env.local
# fill in .env.local
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # Vitest unit + integration
pnpm test:e2e     # Playwright E2E
pnpm verify       # full pre-commit gate
```

## Layout

```
prizm/product/
├── app/                            # Next.js App Router
│   ├── (marketing)/                # public pages
│   ├── (dashboard)/                # authenticated app
│   ├── (auth)/                     # login + register
│   └── api/v1/                     # public REST API
├── components/                     # ui, marketing, dashboard
├── lib/
│   ├── server/                     # server-only code
│   ├── shared/                     # iso (types, validators)
│   └── client/                     # browser-only utilities
├── content/                        # MDX for docs, security, privacy
├── public/.well-known/             # security.txt + privacy-manifest.json
├── supabase/migrations/            # sequential SQL migrations
├── infra/                          # Terraform / CDK
├── tests/{unit,integration,e2e}/
├── docs/{adr,ux,compliance,specs,runbooks,build-handoffs}/
└── .github/workflows/              # CI
```

## Conventions

- Writing protocol per `../../CLAUDE.md` (no em dashes, no semicolons in prose, banned word list).
- Karpathy guidelines for code: minimum that solves the problem, surgical changes, verifiable success criterion per recommendation.
- Every architecture decision goes through an ADR. See `docs/adr/`.
- Every server-side action that touches user data writes an audit event. See `lib/server/audit.ts`.

## License

TBD before launch.
