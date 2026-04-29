# ADR-001: Tech Stack

Status: accepted
Date: 2026-04-28

## Context

PRIZM Phase 1 is a trust-first SOC 2-ready bank statement converter for accountants and bookkeepers. The stack choice drives security-headers posture, deletion attestation, OCR integration, SOC 2 inheritance, and time to MVP.

## Decision

Use Next.js (App Router) + Supabase Auth + Supabase Postgres + Stripe Checkout + Vercel hosting + AWS S3 + AWS Textract + AWS KMS + Resend + Sentry + Upstash Redis.

## Consequences

Eased:

- Each layer ships a SOC 2 Type 2 report we inherit (Vercel, Supabase, Stripe, AWS, Sentry, Upstash). HC1 readiness gets a head start.
- Supabase RLS handles tenancy cleanly. Phase 3 multi-tenant flip is a UI change, not a schema rewrite.
- S3 lifecycle rules give us belt-and-suspenders 24h delete enforcement on the storage layer.
- Vercel manages TLS, edge headers, HSTS preload. Mozilla Observatory grade A is achievable from day one.
- Workspace conventions match the Fin project so the team has muscle memory.

Locked in:

- AWS account dependency for OCR. Vendor switch in Phase 2 is non-trivial.
- Vercel pricing model. Migration off Vercel later is a rewrite of edge config + cron.
- Supabase coupling. Migration off Supabase is a Postgres-keep-everything-else effort.

## Alternatives considered

- Next.js + Cloudflare Workers + D1/R2 + Stripe + Turnstile. Cheaper at scale but D1 is less mature than Supabase Postgres and the talent pool is smaller. Defer until Phase 3 if cost forces it.
- Mirror target stack: Next.js + Kotlin (Spring or Ktor) + Postgres + AWS Lightsail. Two-language burden slows iteration. Lightsail forces single-region thinking. No upside relative to the chosen stack.
- Self-hosted: Next.js + tRPC + Drizzle + Postgres on Hetzner + Tigris. Maximum control but no upstream SOC 2 inheritance and slowest MVP path. Right for LS1 confidential-compute, overkill for Phase 1.

## Verification

- `pnpm install` succeeds with no peer-dependency conflicts.
- `pnpm dev` boots the Next.js app on localhost:3000.
- A round-trip from Next.js to Supabase to S3 to Textract to Stripe webhook completes in dev.
- SOC 2 Type 2 reports for every vendor are linked from `docs/compliance/vendors.md` before launch.

## References

- PRIZM Phase 1 plan: `~/.claude/plans/use-specialized-sub-agents-nifty-torvalds.md`
- PRIZM/runs/2026-04-28-bankstatementconverter/report/FINAL_REPORT.md (audit that produced the thesis)
