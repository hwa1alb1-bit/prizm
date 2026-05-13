# Staging Rehearsal Runbook

Run this rehearsal before promoting PRIZM to production and after any launch-critical change to upload, billing, deletion, audit, provider credentials, alerting, or the Ops Dashboard.

Use a single rehearsal correlation ID for all actions. Store command output, request IDs, audit IDs, screenshots, provider links, and pass/fail notes in the evidence package.

## Preflight Gates

- Run `pnpm verify` from the release candidate SHA.
- Run `pnpm check:launch-gates` with `LAUNCH_GATE_TARGET=staging`.
- Run `pnpm test:connectors:live` only when `LIVE_CONNECTOR_SMOKE=1`, `LAUNCH_GATE_TARGET=staging`, and the staging HTTPS site URL are set.
- Confirm the staging GitHub environment has no static `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`.
- Confirm Ops Dashboard provider credentials are present for Supabase, AWS/S3, Stripe, Resend, Sentry, Upstash, and Cron.
- Call `/api/ops/health` as an ops admin for deep provider health. The public health route is shallow.

## Upload And Conversion Path

- Sign in to staging as a test workspace user.
- Upload a seeded test PDF through the browser flow.
- Verify `/api/v1/documents/presign` returns a request ID, document ID, S3 PUT URL, and 24-hour expiration.
- Complete the browser PUT to S3 and verify S3 CORS accepts the upload from the staging origin.
- Call `/api/v1/documents/{documentId}/complete` and verify it returns a verified document state.
- Call `/api/v1/documents/{documentId}/convert` and verify the conversion moves to processing or ready.
- Poll `/api/v1/documents/{documentId}/status` until the document reaches a terminal state.
- Review parsed statement rows in the browser workflow.
- Create a retained CSV export through `/api/v1/documents/{documentId}/exports`.
- Fetch a signed download URL through `/api/v1/exports/{exportId}/download`.
- Query audit evidence for `document.upload_requested`.

## Cloudflare R2 Kotlin Extraction Proof

- Keep production on Textract while staging proves the Cloudflare path.
- Set `DOCUMENT_STORAGE_PROVIDER=r2`, `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2`, `CLOUDFLARE_EXTRACTOR_URL`, `CLOUDFLARE_EXTRACTOR_TOKEN`, and `CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY` only in the staging environment under test.
- Deploy the container-backed Cloudflare Worker with Docker/WSL or a remote deploy path; the no-Docker Wrangler dry run is not enough for this proof.
- Seed the healthcheck PDF in the R2 upload bucket and call the Worker `/v1/health` endpoint with the extractor bearer token.
- Start and poll a staging extraction against the seeded PDF until the Worker returns normalized statement JSON.
- Run the PRIZM conversion flow through status polling and verify statement persistence through the `statement` row and `document.processing_ready` audit event.
- Force a controlled queue/storage failure and archive retry behavior plus `prizm-extractions-dlq` dead-letter handling evidence.
- Record `CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID`, `CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT`, and `CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA` before considering a production launch gate pass.

## Billing And Webhook Sanity

- Confirm Stripe test-mode keys, webhook secret, publishable key, and four plan price IDs are present in staging launch gates.
- Confirm `STRIPE_METER_OVERAGE` and `STRIPE_PRICE_OVERAGE_PAGE` are present before running overage checks.
- Create a Checkout session through `/api/v1/billing/checkout` for a paid plan.
- Open a Customer Portal session through `/api/v1/billing/portal` for a workspace with a Stripe customer.
- Send a Stripe webhook signature acceptance check to `/api/v1/webhooks/stripe`.
- Send a bad-signature check and verify it returns a sanitized problem response.
- Deliver at least one subscription created or updated event and verify subscription row sync when the customer row exists.
- Query audit evidence for `stripe.<event_type>`.

## Deletion Expiry

- Create or seed a short-expiry staging document and, when available, a matching S3 object.
- Call `/api/ops/deletion/sweep` with `CRON_SECRET`.
- Call `/api/ops/deletion/monitor` with `CRON_SECRET`.
- Verify the database deleted or tombstoned state, S3 deleted or absent state, deletion receipt behavior, and deletion audit event.
- Verify deletion runtime evidence rows such as sweep run, deletion evidence, and deletion health when those tables are present.
- Confirm the Ops Dashboard deletion health widget reflects the last sweep and monitor status.

## Audit Evidence

- Query `audit_event` by rehearsal correlation ID or timestamp window.
- Require evidence for upload requested, Stripe webhook received, ops dashboard read, provider refresh, quick-link click, deletion sweep, and stale-survivor drill if performed.
- Save query output with request IDs and trace IDs.
- Fail the rehearsal if any implemented server-side user-data write lacks an audit event.

## Alert And Ops Dashboard Signal

- Run `/api/ops/collect` with `CRON_SECRET`.
- Read `/api/ops/snapshots` as an ops admin.
- Open `/ops` and confirm launch-required providers are green or explicitly accepted-gray.
- Open at least one provider drill-down and one quick link, then verify audit events for the read and click.
- Run a controlled alert drill by creating a stale deletion survivor, then calling the deletion monitor.
- Verify the monitor returns a red signal, writes stale-survivor audit evidence, and creates or routes the expected Sentry P1 signal.

## Evidence Package

- Release candidate SHA and Vercel deployment URL.
- Launch gate output and live connector smoke output.
- Browser screenshots or traces for upload, Ops Dashboard, provider drill-down, and quick-link flow.
- API responses with request IDs and trace IDs.
- Audit query output and deletion evidence rows.
- Stripe webhook event IDs and subscription row evidence.
- Sentry alert link or drill record.
- Operator, timestamp, environment, pass/fail result, blocked checks, and follow-up issues.

## Pass Criteria

- Every implemented control above passes with evidence.
- Any blocked item maps to an unimplemented roadmap phase and has an issue or roadmap reference.
- No launch-required provider credential is missing or over-scoped without a documented exception.
- The Ops Dashboard is green or accepted-gray for all launch-required providers.
