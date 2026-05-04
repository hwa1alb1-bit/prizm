# PRIZM project memory for Claude Code

@AGENTS.md

PRIZM is a trust-first, SOC 2-ready bank statement converter SaaS. Phase 1 Trust-Native MVP. Multi-tenant by workspace. 24-hour auto-delete on every uploaded document.

## Where to start

1. Read `README.md` for stack, layout, and bring-up steps.
2. Read `docs/specs/wave-0-provisioning-step-by-step.md` for the external-account provisioning checklist.
3. Read the ADRs under `docs/adr/` (numbered 001-007 plus the template) to understand the architectural ground rules.
4. Run `pnpm verify` before claiming any work complete.

## Current state (2026-04-29)

- **Wave 0**: scaffold + verify gate green. Commit `e157c4d`.
- **Wave 1**: connector layer + `/api/health` + landing page + Stripe sandbox provisioning. Commits `5a80d98`, `a4b7f54`, `e40946a`.
- **Wave 2**: not started. Server actions for upload presign, Textract job kickoff, status poll, statement parsing, deletion sweep, Stripe webhook handler.

## Active resource IDs

- Supabase project: `dcirauvtuvvokvcwczft` in `us-east-1`. URL `https://dcirauvtuvvokvcwczft.supabase.co`.
- Stripe sandbox account: `acct_1TRZFv44hvL1QSxT`.
- Stripe price IDs (committed in `.env.example`): Starter Monthly/Annual, Pro Monthly/Annual.
- Stripe overage meter: not yet created. Run `pnpm seed:stripe` with sandbox key in `.env.local` to provision.
- Sentry organization: `prizmview`.
- Sentry project slug: `javascript-nextjs`.
- Cloudflare zone: `prizmview.app`. Account `06194d230f5a7d371ad30a1d984e0868`.
- Vercel team: `plknokos-projects`, ID `team_uZERsB7RBuE8AlDoUPRlw5zz`.
- Upstash Redis: `close-stag-109648` (us-east-1).

## Outstanding per-machine setup

These do not survive a fresh clone and depend on the host:

1. AWS CLI installed and authenticated. Pick `aws configure` (static keys, fast) or `aws configure sso` (short-lived, SOC 2-clean).
2. `.env.local` filled with secrets the user keeps in a password manager or Vercel env. The committed `.env.example` documents every key.
3. Claude Code MCP connectors (Stripe, Supabase, Cloudflare, Vercel, AWS, Filesystem) signed in under the user's claude.ai account. These are user-scoped and follow the user across machines.

## Coding conventions

- **Stack**: Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, pnpm 10, Node 20+.
- **Server-only modules** import `'server-only'` at the top of every file under `lib/server/`.
- **Connectors are lazy singletons** with a `pingX()` helper used by `/api/health`.
- **Env vars** validated by Zod schemas in `lib/shared/env.ts`. Use `assertServerEnv(['KEY'])` inside connector code paths.
- **Generated DB types** at `lib/shared/db-types.ts`. Regenerate with `mcp__cc4633d9-...__generate_typescript_types` (Supabase MCP) when migrations change. Never hand-edit.
- **No em dashes. No semicolons in prose.** TypeScript code uses semicolons. The banned word list lives in the parent project's `CLAUDE.md` (one level up in dev) and applies to all prose: comments, docs, commit messages, and chat.
- **Karpathy guidelines**: minimum that solves the problem, surgical changes, verifiable success criteria.

## Doing work

- Every architecture decision needs an ADR before implementation. Template at `docs/adr/000-template.md`.
- Every server-side action that touches user data records an `audit_event` via `recordAuditEvent` from `lib/server/audit.ts`.
- Use the `superpowers:brainstorming` skill before starting any non-trivial feature.
- Use the `gsd:plan-phase` workflow for phases and the `gsd:execute-phase` workflow to run them.
- Run `pnpm verify` before committing. CI runs the same gate plus Playwright and Mozilla Observatory.

## Don't

- Do not commit `.env.local` or any file with secrets. `.gitignore` excludes `.env*` except `.env.example`.
- Do not bypass RLS unless calling the service-role client from a trusted server path. The audit helper is the only place that should write rows on behalf of an unauthenticated context.
- Do not hand-edit `lib/shared/db-types.ts`. It is regenerated.
- Do not use `--no-verify`, `--no-gpg-sign`, or any flag that skips hooks unless the user explicitly asks.
- Do not amend commits. Always create a new commit.
- Do not push to `main` or open PRs without explicit ask.
