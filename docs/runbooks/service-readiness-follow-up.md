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

The command archives sanitized JSON in `docs/evidence/service-readiness/`. It fails unless the archive proves Vercel, Supabase, Stripe, the Cloudflare R2 extractor, Cloudflare/DNS, Sentry, Resend, and Redis. If a dashboard-only item remains, run:

```bash
$env:SERVICE_READINESS_ALLOW_INCOMPLETE='1'
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

Only use incomplete mode for a handoff archive. The JSON must name an owner and next proof step for every exception.

For a provider that is intentionally informational during the production rehearsal, archive it as accepted-gray instead of leaving an unexplained provider failure:

```powershell
$env:SERVICE_READINESS_ACCEPTED_GRAY_PROVIDERS='[{"provider":"sentry","owner":"Ops","reason":"Error telemetry is informational during launch rehearsal.","nextProofStep":"Verify Sentry alert routing before making the provider launch-required."}]'
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

Use accepted-gray only when the provider state is intentional. The archive fails if an accepted-gray item omits the owner, reason, or next proof step.

Do not use accepted-gray to bypass the Cloudflare R2 extractor proof for launch. AWS Textract is legacy compatibility evidence only and is not a required launch provider when `DOCUMENT_STORAGE_PROVIDER=r2` and `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2`.

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

## Cloudflare R2 Extractor Proof

Required proof:

- `DOCUMENT_STORAGE_PROVIDER=r2` and `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2` are present in the production environment.
- `GET ${CLOUDFLARE_EXTRACTOR_URL}/v1/health` succeeds with `Authorization: Bearer ${CLOUDFLARE_EXTRACTOR_TOKEN}`.
- The health payload reports `jobStateBucket.ok`, `uploadBucket.ok`, `extractionQueue.ok`, and `kotlinExtractor.ok`.
- The returned upload bucket `key` matches `CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY`.
- `CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID`, `CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT`, and `CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA` point to the archived staging Worker/container extraction proof.
- The archived proof includes explicit runtime requirement coverage for Worker health, R2 storage access, extraction success, queue retry policy, and the `prizm-extractions-dlq` dead-letter queue.

After Cloudflare auth is available, validate the Worker resources and seed the healthcheck PDF:

```powershell
pnpm exec wrangler whoami
pnpm exec wrangler deploy --dry-run --config workers/cloudflare-extractor/wrangler.jsonc
pnpm exec wrangler r2 bucket list --config workers/cloudflare-extractor/wrangler.jsonc
pnpm exec wrangler queues list --config workers/cloudflare-extractor/wrangler.jsonc
```

Then call the deployed Worker health endpoint and rerun the archive:

```powershell
Invoke-WebRequest -Uri "$env:CLOUDFLARE_EXTRACTOR_URL/v1/health" -Headers @{ Authorization = "Bearer $env:CLOUDFLARE_EXTRACTOR_TOKEN" } -UseBasicParsing
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
