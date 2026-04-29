# Wave 0 Provisioning Handoff

This document lists the external-account work I cannot do for you. Each item maps to the Wave 0 task list in the Phase 1 plan.

## Order of operations

Do these in order. Each unblocks the next.

### 1. Domain (task 0.1)

- Register `prizm.app` (or pick an alternate from `prizm.so`, `prizm.io`, `tryprizm.com` and update env files).
- Enable DNSSEC at the registrar.
- Enable registrar lock and 2FA on the registrar account.
- Verify with `dig prizm.app +dnssec` returning `RRSIG` records.

### 2. GitHub repo (task 0.2)

- Create private repo `PLKNoko/prizm`.
- Branch protection on `main`: require PR, require status checks, no force-push.
- Add a `CODEOWNERS` file later when the team grows past one operator.
- Push the local repo from `PRIZM/product/` to `PLKNoko/prizm`.

### 3. Supabase (task 0.3)

- Create a project in the target region (`us-east-1` default).
- Enable Auth + Postgres.
- Enable Point in Time Recovery (PITR).
- Copy the project URL and the anon key into Vercel env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Copy the service role key into a server-only Vercel env var (`SUPABASE_SERVICE_ROLE_KEY`).
- Run migration 0001: `supabase db push` from the product/ directory once Supabase CLI is linked.

### 4. Vercel (task 0.4)

- Create a Vercel project. Link to the GitHub repo.
- Attach `prizm.app` as the production domain. Configure DNS at the registrar to point to Vercel.
- Configure preview deployments for all PRs.
- Add env vars from `.env.example` per environment (production, preview, development).

### 5. AWS (tasks 0.5 to 0.8)

- Create a dedicated AWS Organization.
- Create sub-accounts: `prizm-prod`, `prizm-staging`.
- Enable IAM Identity Center.
- Create an OIDC provider for Vercel (issuer `https://oidc.vercel.com`) and an IAM role that Vercel functions assume. Grant only the permissions listed below.
- Create S3 buckets: `prizm-uploads-prod`, `prizm-uploads-staging`.
  - Versioning OFF.
  - Lifecycle expiration: 1 day on prefix `*`.
  - Public access blocked at account and bucket level.
  - Server-side encryption: SSE-KMS with the customer-managed CMK.
- Create a customer-managed KMS CMK in each region.
  - Key policy: grants Vercel role + AWS Textract service role.
  - Multi-region replication: enabled.
  - Deletion locked behind 30-day waiting period.
- Configure Textract permissions on the Vercel role: `textract:StartDocumentAnalysis`, `textract:GetDocumentAnalysis` against the PRIZM buckets only.

### 6. Stripe (task 0.9)

- Test mode + live mode accounts (use the same Stripe org).
- Products: Free, Starter, Pro.
- Prices per product: monthly + annual (annual = 2 months free).
- Configure Customer Portal (cancel + plan change + invoices visible).
- Webhook endpoint registered at `https://prizm.app/api/v1/webhooks/stripe` with signing secret. Save secret to Vercel env (`STRIPE_WEBHOOK_SECRET`).
- `stripe trigger checkout.session.completed` reaches the webhook in dev.

### 7. Resend (task 0.10)

- Create account.
- Verify `prizm.app` domain. Add SPF, DKIM, DMARC records at the registrar.
- API key in Vercel env (`RESEND_API_KEY`).
- Set `RESEND_FROM_EMAIL=noreply@prizm.app`.

### 8. Sentry (task 0.11)

- Create project `prizm-web`.
- DSN in Vercel env (`NEXT_PUBLIC_SENTRY_DSN`).
- Auth token + org + project for source-map uploads.
- PII scrubbing: confirm default-on.

### 9. Upstash Redis (task 0.7 dep)

- Create a Redis database in the same region as Vercel default.
- REST URL + token in Vercel env (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

### 10. Mailboxes (task 0.7 dep, QW7)

- Create or alias these inboxes against your existing email host:
  - `dpo@prizm.app`
  - `legal@prizm.app`
  - `privacy@prizm.app`
  - `security@prizm.app`
  - `support@prizm.app`
- Configure auto-responders:
  - `dpo@`, `privacy@`: 30-day SAR SLA acknowledgment.
  - `security@`: 48-hour acknowledgment per security.txt commitment.
  - `legal@`: 5-business-day acknowledgment.
  - `support@`: 1-business-day acknowledgment.

### 11. Local env (task 0.14)

- `cp .env.example .env.local` in `prizm/product/`.
- Fill in real values for Supabase, AWS, Stripe (test mode), Resend, Sentry, Upstash.
- Never commit `.env.local`.
- For team members: use Doppler if more than one operator needs shared dev creds.

### 12. CI / CD secrets (task 0.15)

- Add to GitHub repo secrets:
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` for Vercel deployments.
  - `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` for source-map uploads.
- Vercel handles auto-deploy on `main` push and preview on PR.

### 13. Brand seed (task 0.12)

- Pick logo wordmark, primary palette (3 colors), accent (2 colors), typography pair.
- Drop SVG logo at `public/logo.svg` and `public/favicon.ico`.
- Tokens go to `styles/tokens.css` for the UI Designer (B3) to refine in Wave 2.

## What I will do once you finish provisioning

- Apply Supabase migration 0001 via `supabase db push`.
- Smoke test the Stripe webhook handler against a local test event.
- Verify S3 bucket lifecycle policy is in place.
- Verify Mozilla Observatory grade A on staging.
- Start Wave 1 (Architecture + UX + Compliance baseline).

## Safety net

- If any provisioning step fails, file the failure in `docs/build-handoffs/wave-0-blockers.md` and we course-correct. No external service is irreversible at Wave 0 cost.
- Never paste secrets into chat. Always set them via the vendor dashboard or Vercel CLI.
