# PRIZM Production Roadmap and Ops Dashboard Design

Status: approved design direction
Date: 2026-05-05
Owner: PRIZM engineering

## Purpose

PRIZM should be developed as a production and SOC 2 posture project, not as a fast prototype. The product promise is a trust-first bank statement converter for accountants and bookkeepers. The roadmap must make conversion quality, deletion evidence, auditability, billing controls, and operational visibility launch requirements.

This spec adds a Centralized Ops Dashboard as a primary management component. The dashboard monitors provider usage, service limits, quota pressure, billing status, and provider access links from one protected control plane.

## Current Repo State

Implemented:

- Next.js 16 App Router scaffold with React 19, TypeScript, Tailwind 4, and Supabase auth middleware.
- Magic-link login and register pages.
- Authenticated dashboard shell with upload, history, billing, and settings routes.
- PDF upload UI that calls a presign endpoint and uploads directly to S3.
- `/api/v1/documents/presign` creates a `document` row and returns a KMS-backed S3 PUT URL.
- `/api/health` pings Supabase, Stripe, S3, Textract, Resend, Redis, and Sentry wrappers.
- Stripe webhook signature verification and partial subscription sync.
- Supabase schema for workspaces, profiles, API keys, documents, statements, subscriptions, credit ledger, audit events, RLS, and bootstrap trigger.
- CI workflow with format, lint, typecheck, unit tests, build, Playwright, and a staging security-header job that currently skips when staging is not configured.

Known gaps:

- `pnpm dev` uses port `3030`, while README and Playwright expect `3000`.
- Local `node_modules` is absent in the inspected checkout, so `pnpm verify` fails before Prettier can run.
- Current tests are smoke-level only.
- Upload stops after S3 PUT. There is no upload-complete route, S3 object verification, Textract start, status polling, statement parser, export, or abandoned-upload cleanup.
- Deletion is mostly an ADR promise. Cron sweep, stale-row monitor, S3 deletion verification, deletion receipts, and Sentry paging are not implemented.
- Rate-limit and idempotency helpers exist but are not applied to routes.
- Routes return ad hoc JSON errors rather than RFC 7807 `problem+json`.
- `/api/health?deep=true` can expose raw provider error text and should not be public.
- The presign route writes user data through the service-role client and does not record an audit event.
- Billing UI, Checkout, Customer Portal, usage reporting, credit debits, and webhook idempotency are incomplete.
- Privacy and security claims reference endpoints and pages that do not exist yet.
- `components/` is absent, although README describes it as a project layer.

## Product Direction

The chosen optimization target is production and SOC 2 posture. Each phase should leave behind evidence, tests, runbooks, audit logs, and operational controls. The working rule is:

> A feature is not done until it is observable, auditable, rate-limited where appropriate, tested, documented, and recoverable.

## Roadmap Overview

1. Foundation and release gates
2. Centralized Ops Dashboard and provider collector
3. Core conversion pipeline
4. Deletion and evidence runtime
5. Billing, credits, and plan enforcement
6. Compliance and trust surface
7. Staging and production launch gates
8. Post-launch hardening and SOC 2 evidence loop

The Ops Dashboard belongs in phase 2 because it supports every later production gate. It should be available before beta traffic begins.

## Phase 1: Foundation and Release Gates

Objective: make the repo safe to build on.

Scope:

- Align local and test server ports. Prefer `3030` everywhere if that is the project convention, or change `pnpm dev` back to `3000` and update docs.
- Restore install and verification path with `pnpm install --frozen-lockfile`.
- Make `pnpm verify` run format, lint, typecheck, unit tests, and build.
- Add a separate `pnpm verify:full` that includes Playwright and live connector smoke tests.
- Add route tests for auth, presign validation, health, Stripe webhook signature checks, and error responses.
- Replace public deep health checks with:
  - `/api/health` public shallow status without raw errors.
  - `/api/ops/health` protected deep provider status.
- Add request IDs and Sentry trace IDs to route responses.
- Add RFC 7807 response helpers and convert public route errors to `application/problem+json`.
- Add security headers and CSP in `next.config.ts`.
- Enforce audit-on-write for server-side user-data mutations.
- Decide how service-role writes are allowed. Normal user writes should use a user-scoped server client unless a privileged server action is explicitly required and audited.

Exit gates:

- `pnpm verify` passes locally and in CI.
- Playwright smoke targets the correct port.
- All public API error responses follow the shared problem schema.
- `/api/health` does not expose secrets, raw provider errors, or live deep checks.
- Presign creates an audit event or fails closed.

## Phase 2: Centralized Ops Dashboard and Provider Collector

Objective: build the PRIZM control plane for real-time operational awareness, quota risk, and provider access.

### Product Requirements

The Ops Dashboard must provide:

- Dedicated admin login gateway.
- Provider usage widgets for Cloudflare, Vercel, Upstash, Supabase, Sentry, Resend, AWS mailboxes, and Stripe.
- Current usage, limits, quotas, plan metadata, billing periods, freshness, and collection status.
- Green, yellow, red, and gray health indicators.
- Progress bars for quota-bound metrics.
- Quick Login deep-links to the provider console page for billing, usage, project, or service management.
- Manual refresh for admins with rate-limit protection.
- Audit events for admin login, dashboard reads, provider refreshes, quick-link clicks, and failed provider collection.
- Sentry alerts when a critical provider is red or data is stale past SLA.

### Authentication

Use Supabase Auth for identity, but require a separate admin authorization layer:

- Add `ops_admin` table or role mapping with user ID, role, granted_by, created_at, revoked_at.
- Require `owner` or `admin` in `ops_admin` for all `/ops` routes.
- Re-check authorization in every Server Component, Server Action, and Route Handler.
- Do not rely on middleware as the only authorization gate.
- Add optional step-up auth before showing provider data. Initial version can use a short-lived admin session flag after re-authentication by magic link. Later version should add Supabase MFA if available in the project plan.
- Store provider tokens only as Vercel environment variables or a managed secret store. Never store provider API tokens in client code, local storage, or Supabase tables.

Routes:

- `/ops/login`: dedicated admin gateway.
- `/ops`: overview dashboard.
- `/ops/providers/[provider]`: provider drill-down.
- `/api/ops/snapshots`: authenticated read API for normalized snapshots.
- `/api/ops/collect`: cron-only collector endpoint protected by `CRON_SECRET`.
- `/api/ops/collect/[provider]`: admin-triggered refresh with strict rate limits.
- `/api/ops/stream`: optional Server-Sent Events endpoint for snapshot updates.

### Collection Architecture

Use a server-side snapshot collector. Do not fan out from the browser to provider APIs.

Flow:

1. Vercel Cron calls `/api/ops/collect` every 5 to 15 minutes.
2. The collector loads active provider adapters.
3. Each adapter calls its provider API with server-only credentials.
4. Responses are normalized into a shared snapshot model.
5. Raw sensitive response fields are discarded.
6. Normalized metrics are written to Supabase.
7. Status is computed from usage percentage, staleness, provider errors, and manually configured limits.
8. Dashboard reads the latest snapshot per provider and metric.
9. Client widgets refresh with SWR or TanStack Query. SSE can push new snapshot timestamps when needed.

This gives near-real-time visibility without exposing secrets or making the dashboard depend on live provider fan-out.

### Data Model

Tables:

```sql
ops_provider (
  id text primary key,
  display_name text not null,
  category text not null,
  enabled boolean not null default true,
  console_url text not null,
  billing_url text,
  management_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ops_metric_config (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references ops_provider(id),
  metric_key text not null,
  display_name text not null,
  unit text not null,
  warning_threshold numeric not null default 0.70,
  critical_threshold numeric not null default 0.85,
  manual_limit numeric,
  required boolean not null default true,
  sort_order int not null default 0,
  unique (provider_id, metric_key)
);

ops_usage_snapshot (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references ops_provider(id),
  metric_key text not null,
  used numeric,
  limit_value numeric,
  unit text not null,
  period_start timestamptz,
  period_end timestamptz,
  status text not null check (status in ('green','yellow','red','gray')),
  freshness text not null check (freshness in ('fresh','stale','failed')),
  source_url text,
  collected_at timestamptz not null default now(),
  error_code text,
  error_detail text,
  raw_ref jsonb
);

ops_collection_run (
  id uuid primary key default gen_random_uuid(),
  provider_id text,
  trigger text not null check (trigger in ('cron','manual','deploy','test')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','partial','failed')),
  metrics_count int not null default 0,
  error_detail text
);
```

TypeScript shape:

```ts
type ProviderId =
  | 'cloudflare'
  | 'vercel'
  | 'upstash'
  | 'supabase'
  | 'sentry'
  | 'resend'
  | 'aws-mailboxes'
  | 'stripe'

type OpsUsageSnapshot = {
  provider: ProviderId
  metric: string
  used: number | null
  limit: number | null
  unit: 'requests' | 'bytes' | 'emails' | 'events' | 'connections' | 'usd' | 'status' | 'count'
  periodStart: string | null
  periodEnd: string | null
  status: 'green' | 'yellow' | 'red' | 'gray'
  freshness: 'fresh' | 'stale' | 'failed'
  sourceUrl: string
  collectedAt: string
}
```

Status rules:

- Green: below 70 percent of configured or provider-reported limit.
- Yellow: 70 to 85 percent.
- Red: above 85 percent, over limit, provider API failure for a required metric, or stale beyond SLA.
- Gray: unsupported metric, no configured limit, or intentionally informational.

Freshness rules:

- Fresh: collected within the provider's expected interval.
- Stale: last successful snapshot is older than the provider SLA.
- Failed: latest collection failed and no acceptable prior snapshot exists.

### Provider Adapter Interface

Each provider integration implements the same contract:

```ts
export type ProviderAdapter = {
  id: ProviderId
  collect(input: CollectionContext): Promise<ProviderMetric[]>
  health(input: CollectionContext): Promise<ProviderAdapterHealth>
}

export type ProviderMetric = {
  metricKey: string
  displayName: string
  used: number | null
  limit: number | null
  unit: OpsUsageSnapshot['unit']
  periodStart?: string | null
  periodEnd?: string | null
  sourceUrl: string
  rawRef?: Record<string, unknown>
}
```

Adapters must:

- Use lazy SDK or HTTP client initialization.
- Time out quickly and fail independently.
- Redact secrets before logging.
- Return partial results when one metric fails but others succeed.
- Map provider rate-limit responses to collection-run status.
- Record provider API rate-limit headers when available.

### Provider Coverage

Cloudflare:

- Source: GraphQL Analytics API for HTTP request and traffic metrics.
- Metrics: requests, bandwidth, cached bandwidth, WAF events if enabled, zone health.
- Limits: plan limits are not always returned with analytics responses. Store known plan limits in `ops_metric_config` when provider limits are unavailable.
- Quick links: Cloudflare dashboard zone analytics, billing, DNS, WAF.
- Reference: https://developers.cloudflare.com/analytics/graphql-api/

Vercel:

- Source: Vercel REST API for project/team metadata and billing usage API where available. The `vercel usage --format json` command is also a useful implementation reference for usage and cost data.
- Metrics: bandwidth, function execution, build minutes, edge requests, projected cost, current billing usage.
- Caveat: detailed observability queries may depend on plan and Vercel Observability access. PRIZM should also instrument its own route counts so critical API usage is visible even if Vercel usage APIs are limited.
- Quick links: Vercel Usage, project deployments, Functions, Logs, billing.
- References:
  - https://vercel.com/docs/rest-api
  - https://vercel.com/docs/cli/usage

Upstash:

- Source: Upstash Developer API and Redis database stats where available.
- Metrics: request count, bandwidth, memory, max clients, command rate, database state.
- Caveat: Developer API is available for native Upstash accounts. Accounts created via third-party marketplaces may not support it.
- Quick links: Upstash database metrics, usage, billing, API keys.
- Reference: https://upstash.com/docs/devops/developer-api/introduction

Supabase:

- Source: Supabase Metrics API for Prometheus-compatible database health metrics and Management API for project metadata.
- Metrics: database connections, CPU, IO, WAL, storage-related signals, project status, and usage items that are available by plan.
- Caveat: the Metrics API is beta and metric names can evolve. Store adapter version and tolerate renamed metrics with mapping tests.
- Quick links: Supabase project usage, database reports, logs, backups, billing.
- References:
  - https://supabase.com/docs/guides/telemetry/metrics
  - https://supabase.com/docs/reference/api/introduction

Sentry:

- Source: Sentry organization `stats_v2`.
- Metrics: accepted error events, transaction events, attachments, replays, rate-limited events, monitor events.
- Limits: compare against configured plan caps.
- Quick links: Sentry usage, issues, performance, alerts.
- Reference: https://docs.sentry.io/api/organizations/retrieve-event-counts-for-an-organization-v2/

Resend:

- Source: local PRIZM email ledger plus Resend list endpoints and webhooks where useful.
- Metrics: sent transactional emails, inbound emails, bounced emails, spam complaints, daily and monthly quota pressure.
- Caveat: current month usage is documented as visible in the Resend Usage page. If Resend does not expose a direct usage endpoint for the required numbers, PRIZM should treat its own send ledger and inbound webhook ledger as the source of operational usage and compare that against configured plan limits.
- Quick links: Resend Usage, Domains, Emails, API Keys, Webhooks.
- Reference: https://resend.com/docs/knowledge-base/account-quotas-and-limits

AWS mailboxes:

- Source: AWS SES `GetSendQuota`, SES send statistics, and S3 metrics if inbound mail is written to S3.
- Metrics: sent last 24 hours, max 24-hour sends, max send rate, inbound mailbox bucket object count and storage bytes.
- Caveat: "mailbox storage" depends on the receiving architecture. If inbound mail lands in S3, monitor the S3 bucket. If mailboxes live in Google Workspace or another provider, add that provider as a separate adapter later.
- Quick links: SES account dashboard, verified identities, sending statistics, S3 inbound bucket.
- Reference: https://docs.aws.amazon.com/ses/latest/APIReference/API_GetSendQuota.html

Stripe:

- Source: local webhook-synced subscription table plus periodic reconciliation through Stripe Subscriptions API.
- Metrics: PRIZM subscription status, billing cycle, current period end, payment failure state, overage meter configuration, latest invoice state.
- Operational role: Stripe here monitors PRIZM's own billing relationship and customer billing system health. It is not a generic provider quota widget.
- Quick links: Stripe dashboard subscription, customers, invoices, webhooks, billing portal config.
- Reference: https://docs.stripe.com/api/subscriptions

### Frontend Framework

Use Next.js 16 App Router with React 19. This is already the repo stack and is the best fit for the Ops Dashboard because it keeps secrets server-side, supports protected Server Components, and deploys naturally on Vercel.

Frontend stack:

- Next.js App Router for route structure.
- React Server Components for initial data load and authorization.
- Client components only for interactive widgets, filters, refresh buttons, charts, and live update indicators.
- shadcn/ui-style primitives for buttons, cards, tabs, tables, badges, progress bars, dialogs, skeletons, and dropdowns.
- Recharts or visx for compact time-series charts.
- SWR or TanStack Query for client refresh and stale snapshot handling.
- Server-Sent Events for near-real-time updates after collector runs. Polling every 30 to 60 seconds is acceptable for the first version.

Do not use Grafana as the primary dashboard UI. Grafana can be a supporting integration for metrics exploration, especially for Supabase, but PRIZM needs a product-specific control plane with admin auth, audit events, provider quick links, quota semantics, and launch-readiness workflows.

### UI Layout

The dashboard should be dense and operational:

- Top summary bar: overall status, last successful collection, red widget count, projected monthly overage risk.
- Provider grid: one widget per provider with traffic-light status, primary usage bar, secondary metrics, freshness, and Quick Login.
- Critical alerts rail: stale data, red metrics, failed collectors, billing risk, missing credentials.
- Drill-down page: trend chart, metric table, latest collection runs, provider links, and remediation notes.
- Admin audit panel: recent ops admin access and refresh actions.

Widget states:

- Loading: skeleton with provider name and last known status if available.
- Fresh green: normal card with progress bar.
- Yellow: warning accent and upgrade review copy.
- Red: high-contrast indicator, recommended action, and quick link.
- Gray: informational state with reason, such as unsupported API metric.
- Failed: last successful snapshot plus failed collection details.

### Security and Compliance Controls

Ops Dashboard controls:

- All `/ops` access requires authenticated user and `ops_admin` authorization.
- All provider data is fetched server-side.
- Provider tokens are scoped to read-only usage or billing where the provider supports scoped tokens.
- Provider tokens are rotated and documented in the runbook.
- Every widget fetch and provider collection run writes an `audit_event`.
- Admin quick links use normal external navigation, not embedded provider sessions.
- Dashboard responses must not include provider token fragments, raw request headers, or full provider errors.
- Failed provider calls should show sanitized error codes and store detailed server logs in Sentry.
- Rate-limit manual refreshes per admin and per provider.
- Add a break-glass path for disabling a provider adapter without deploying code.

## Phase 3: Core Conversion Pipeline

Objective: make a statement upload turn into a useful, verified output.

Scope:

- Add upload-complete route that verifies S3 object existence, size, content type, encryption, and workspace ownership.
- Transition document status from `pending` to `processing`.
- Start Textract analysis from the verified S3 object.
- Store Textract job ID and page count.
- Add status route for document processing.
- Add polling or webhook-compatible completion flow.
- Parse Textract output into normalized statement data and transactions.
- Reconcile opening balance, closing balance, reported total, and computed total.
- Store statement rows with expiration aligned to document expiration.
- Add history list, statement detail, failure states, and CSV export.
- Add abandoned-upload cleanup for documents that never receive upload completion.
- Apply route rate limits and idempotency keys.
- Write audit events for upload requested, upload completed, processing started, processing failed, statement ready, export downloaded, and document expired.

Exit gates:

- A seeded test PDF completes upload, processing, parsing, reconciliation, history display, and export in staging.
- Parser has unit tests for representative statement layouts.
- Failure states do not leave documents stuck forever.
- Workspace A cannot read or mutate Workspace B documents.

## Phase 4: Deletion and Evidence Runtime

Objective: turn the 24-hour deletion promise into a verifiable runtime control.

Scope:

- Ensure S3 lifecycle is provisioned and verified for every upload bucket.
- Add Vercel Cron route for deletion sweep every 15 minutes.
- Sweep expired documents and statements where `expires_at < now()` and `deleted_at is null`.
- Delete or verify absence of S3 objects.
- Write deletion audit events.
- Send deletion receipt email within the promised window.
- Add 5-minute stale survivor monitor.
- Page Sentry P1 when expired rows survive past grace period.
- Add evidence queries for auditors.
- Add admin dashboard widget for deletion health.

Exit gates:

- Forced-expiry test proves DB rows, S3 object state, audit event, and receipt behavior.
- Disabling sweep triggers monitor alert in staging.
- Ops Dashboard shows deletion health and last sweep status.

## Phase 5: Billing, Credits, and Plan Enforcement

Objective: make paid usage safe, predictable, and auditable.

Scope:

- Add Stripe Checkout session route.
- Add Customer Portal session route.
- Upsert Stripe customer and subscription rows.
- Add webhook event ledger with idempotency by Stripe event ID.
- Sync subscription state by retrieving current Stripe subscription on webhook events.
- Load overage price and meter env vars in `lib/shared/env.ts`.
- Add credit grants per billing period.
- Debit credits on successful conversion.
- Report metered usage to Stripe when overage applies.
- Enforce upload and conversion limits by plan.
- Add billing UI with plan, usage, next renewal, invoices, and portal link.
- Add Ops Dashboard Stripe widget for webhook health and billing state.

Exit gates:

- Webhook replay is safe.
- Subscription created from Checkout appears in app without manual DB edits.
- Plan limits block overuse with problem responses.
- Failed payment state prevents paid-only conversions while preserving data access rules.

## Phase 6: Compliance and Trust Surface

Objective: align public claims, legal artifacts, and runtime behavior.

Scope:

- Add `/security`, `/privacy`, `/terms`, `/status`, `/docs/errors`, `/docs/rate-limits`, `/security/subprocessors`, and security policy pages.
- Add `public/.well-known/pgp-key.txt` or remove the security.txt reference until available.
- Add data export and account deletion endpoints promised by the privacy manifest.
- Add SAR and deletion request workflows.
- Add vendor/subprocessor inventory and DPA links.
- Add incident response runbook.
- Add operational runbooks for provider outages, quota exhaustion, deletion failure, Stripe webhook replay, and AWS/Textract degradation.
- Add SOC 2 evidence queries for audit events, deletion sweeps, admin access, and provider health.

Exit gates:

- Privacy manifest matches real endpoints.
- Security.txt links resolve.
- Trust pages do not overclaim controls that are not implemented.
- Runbooks include owners, severity, detection, response, and verification.

## Phase 7: Staging and Production Launch Gates

Objective: promote only when the system can be operated.

Scope:

- Provision staging and production Vercel environments.
- Apply Supabase migrations through a documented procedure.
- Verify AWS OIDC role assumption from Vercel.
- Verify S3 CORS for browser PUT uploads.
- Verify Resend DKIM, SPF, DMARC, and mailboxes.
- Verify Sentry source maps and alert routing.
- Verify Upstash Redis token rotation and rate-limit behavior.
- Enforce Observatory security-header job once `STAGING_HOST` is set.
- Add live connector smoke tests behind safe flags.
- Add rollback procedure for app deploys and database migrations.
- Run an end-to-end staging rehearsal with a test PDF and deletion expiry.

Exit gates:

- Ops Dashboard is green or accepted-gray for all launch-required providers.
- No critical trust page link is broken.
- No provider credential is missing or over-scoped without documented exception.
- Staging rehearsal passes conversion, billing, deletion, audit, and alert checks.

## Phase 8: Post-Launch Hardening and SOC 2 Evidence Loop

Objective: make operations repeatable and evidence collection boring.

Scope:

- Add scheduled evidence exports.
- Add weekly provider quota review.
- Add monthly access review for `ops_admin`.
- Add Sentry alert tuning.
- Add cost anomaly detection.
- Add parser quality metrics and manual review workflow.
- Add audit-log UI for workspace owners.
- Add multi-workspace UI and RBAC expansion when single-workspace MVP is stable.
- Add API key management UI and external API onboarding.

Exit gates:

- Monthly SOC 2 evidence pack can be generated without ad hoc SQL.
- Provider limits are reviewed before they become incidents.
- Admin access review has an audit trail.

## Implementation Boundaries

Do now:

- Treat Ops Dashboard as part of production architecture.
- Build normalized provider adapters behind server-only code.
- Use Supabase for snapshots and audit events.
- Keep frontend in Next.js.
- Add manual metric limits where provider APIs do not expose plan caps.

Do not do now:

- Do not embed provider dashboards in iframes.
- Do not put provider API keys in the browser.
- Do not use Grafana as the primary admin UI.
- Do not build team-wide RBAC before single-workspace conversion is stable.
- Do not launch public trust claims before runtime controls exist.

## Verification Strategy

Unit tests:

- Provider adapter normalization.
- Threshold status calculation.
- Freshness calculation.
- Problem response helpers.
- Audit-on-write wrappers.
- Stripe webhook idempotency.
- Parser fixtures.

Integration tests:

- Ops snapshot write and read.
- Protected `/ops` access denied for non-admin users.
- Admin access allowed for active ops admin.
- Presign and upload-complete route state transitions.
- Deletion sweep with mocked S3.
- Rate-limit headers and 429 behavior.

E2E tests:

- Admin logs in and sees Ops Dashboard snapshot cards.
- Upload test PDF, see processing, see statement output, export CSV.
- Billing upgrade flow against Stripe test mode.
- Expired document disappears and receipt is visible in audit trail.

Live staging checks:

- Cloudflare analytics adapter returns a snapshot.
- Vercel usage adapter returns a snapshot or accepted-gray unsupported status.
- Upstash database metrics return a snapshot.
- Supabase Metrics API returns DB health.
- Sentry stats return event counts.
- Resend send ledger and configured quota show usage.
- SES send quota returns limits.
- Stripe subscription reconciliation succeeds.

## Source References

- Cloudflare GraphQL Analytics API: https://developers.cloudflare.com/analytics/graphql-api/
- Vercel REST API: https://vercel.com/docs/rest-api
- Vercel usage CLI: https://vercel.com/docs/cli/usage
- Supabase Metrics API: https://supabase.com/docs/guides/telemetry/metrics
- Supabase Management API: https://supabase.com/docs/reference/api/introduction
- Upstash Developer API: https://upstash.com/docs/devops/developer-api/introduction
- Sentry stats API: https://docs.sentry.io/api/organizations/retrieve-event-counts-for-an-organization-v2/
- Resend quotas and limits: https://resend.com/docs/knowledge-base/account-quotas-and-limits
- AWS SES GetSendQuota: https://docs.aws.amazon.com/ses/latest/APIReference/API_GetSendQuota.html
- Stripe Subscriptions API: https://docs.stripe.com/api/subscriptions
