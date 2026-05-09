# Service Readiness Follow-Up

Owner: Ops

This runbook proves the production stack is operable, not merely deployed. It is the Branch 4 readiness gate for `prizmview.app`.

## Evidence Collection

Run the archive command from a clean checkout on the service-readiness branch. Prefer
`vercel env run` for production checks so production environment variables stay in
Vercel and are not written to `.env.local`:

```bash
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

For a complete run, provide an authenticated owner/admin ops session cookie without
committing it. `/api/ops/health` accepts the Supabase browser session cookie; bearer
tokens are not a supported readiness-auth path.

```bash
$env:OPS_HEALTH_COOKIE='<redacted browser cookie>'
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

The command archives sanitized JSON in `docs/evidence/service-readiness/`. It fails unless the archive proves Vercel, Supabase, Stripe, Cloudflare/DNS, Sentry, AWS/S3/Textract, Resend, and Redis. If a dashboard-only item remains, run:

```bash
$env:SERVICE_READINESS_ALLOW_INCOMPLETE='1'
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

Only use incomplete mode for a handoff archive. The JSON must name an owner and next proof step for every exception.

## Stripe Proof

Required proof:

- Webhook endpoint exists at `https://prizmview.app/api/v1/webhooks/stripe`.
- Subscribed events include `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- Recent Stripe event delivery has `delivery_success=true`.
- An active Billing Customer Portal configuration exists.
- A completed Checkout Session led to a mirrored subscription and a positive `subscription_grant` row in `credit_ledger`.

To prove the checkout-to-credit path, complete a test checkout, then rerun with:

```bash
$env:SERVICE_READINESS_STRIPE_CHECKOUT_SESSION_ID='cs_test_or_live_...'
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

The command retrieves the Checkout Session, resolves the workspace, and checks Supabase for the credit grant. Use the Stripe dashboard only to capture supplemental screenshots; the JSON archive is the acceptance record.

## AWS Textract Subscription

Required proof:

- Production `/api/ops/health` reports both `s3` and `textract` as healthy.
- S3 bucket access, AWS credentials, and `AWS_REGION=us-east-1` are proven separately from Textract service entitlement.
- A Textract failure with `connector_subscription_required` means the production AWS account/role has not been enabled or subscribed for Textract in `us-east-1`; do not treat this as a generic IAM or S3 failure.

Use the local AWS CLI to prove the remaining Textract action after signing in with the production account or role:

```powershell
aws sts get-caller-identity --region us-east-1
aws textract get-document-analysis --region us-east-1 --job-id prizm-health-probe
```

The expected healthy proof is an AWS Textract response that reaches the service, usually an invalid-job response for `prizm-health-probe`. If the CLI returns `The AWS Access Key Id needs a subscription for the service.`, enable or subscribe AWS Textract for the production AWS account/role in `us-east-1`, then rerun:

```powershell
aws textract get-document-analysis --region us-east-1 --job-id prizm-health-probe
$env:OPS_HEALTH_COOKIE='<redacted browser cookie>'
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

## DNSSEC And Cloudflare

Required proof:

- `prizmview.app` has a public DS record.
- Cloudflare DNS import template no longer contains placeholder DKIM.
- Live DNS matches the Vercel apex, Vercel `www`, Resend bounce MX, Resend SPF, and DMARC expectations.

If DS is missing, enable DNSSEC in Cloudflare, copy the DS values to the registrar, wait for propagation, and rerun:

```powershell
Resolve-DnsName prizmview.app -Type DS
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

The Cloudflare template at `infra/cloudflare/prizmview-app.zone` remains the repo-owned desired state. Live Cloudflare dashboard changes are not accepted until public DNS agrees.

## GitHub Governance

Required proof for the public repository:

- Repository visibility is public.
- Active ruleset or branch protection requires CI status checks for `main`.
- Dependabot config exists and Dependabot security updates are enabled.
- Vulnerability alerts and secret scanning are enabled.
- `staging` and `production` environments have protection through reviewers, wait timers, or deployment branch policies.

Use GitHub settings for dashboard-only changes, then rerun the archive command. Do not claim governance is ready from checked-in workflow files alone.

## Dashboard-Only Exceptions

Some provider states are visible only in dashboards or provider-specific APIs. Exceptions are acceptable only when the archive records:

- area,
- exact missing proof,
- owner,
- next proof step.

No item should stay dashboard-only across two readiness runs without a dated owner update in the monthly evidence pack.
