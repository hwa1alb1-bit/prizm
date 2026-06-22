# Stripe Live Cutover Runbook

Owner: Billing owner

This runbook records the live Stripe cutover for PRIZM production. It is for switching existing production configuration from Stripe test mode to live mode; it does not provision products, change prices, or widen billing behavior.

## Scope

Use this runbook when `pdftoexcelstatementconverter.com` is ready to receive live Stripe billing events at `https://pdftoexcelstatementconverter.com/api/v1/webhooks/stripe`.

The live webhook endpoint must subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Preconditions

- Stripe Dashboard is in live mode before copying keys or webhook secrets.
- The endpoint URL is registered in the live Stripe account, not a test-mode endpoint.
- Vercel CLI is authenticated to `plknokos-projects/prizm`.
- The checkout, billing portal, and webhook handler code is already deployed on `main`.
- Keep all copied values out of shell history, Git, screenshots, and chat.

## Production Environment Change

Update only the Vercel Production target. Do not commit these values to `.env`, `.env.production`, or `.env.example`.

Expected prefixes:

- `STRIPE_SECRET_KEY` starts with `sk_live_`.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`.
- `STRIPE_WEBHOOK_SECRET` starts with `whsec_`.

Use a local secure prompt or pipe the values from a temporary secret source:

```powershell
$stripeSecretKey | vercel env add STRIPE_SECRET_KEY production --force --yes --non-interactive --scope plknokos-projects
$stripePublishableKey | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production --force --yes --non-interactive --scope plknokos-projects
$stripeWebhookSecret | vercel env add STRIPE_WEBHOOK_SECRET production --force --yes --non-interactive --scope plknokos-projects
```

After the update, confirm the records are present without printing values:

```powershell
vercel env ls production --format json --non-interactive --scope plknokos-projects
```

The three variables should be `target=production` and `type=sensitive`.

## Redeploy

Existing Vercel deployments do not prove they are running the new production environment. Redeploy the current production deployment after the env update:

```powershell
vercel redeploy <current-production-deployment-url> --target production --non-interactive --scope plknokos-projects
```

Record the new deployment ID, production URL, and alias update.

## Verification

Run the offline launch gate through Vercel production envs:

```powershell
$env:LAUNCH_GATE_TARGET='production'
vercel env run -e production --scope plknokos-projects -- pnpm check:launch-gates
```

Confirm the webhook route rejects unsigned traffic. This checks that the route is reachable and fails closed before Stripe signature verification:

```powershell
curl.exe -s -o NUL -w "status=%{http_code}" -X POST https://pdftoexcelstatementconverter.com/api/v1/webhooks/stripe -H "Content-Type: application/json" --data "{}"
```

Expected result: `status=400`.

If capturing the response body in a controlled environment, the problem code should be `PRZM_AUTH_STRIPE_SIGNATURE_MISSING`. Do not use this unsigned probe as delivery proof; real delivery proof comes from the Stripe Dashboard delivery log or the service readiness archive.

Run service readiness after a real Stripe delivery or checkout event is available:

```powershell
vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

## Evidence To Archive

Archive non-secret evidence in the service readiness or monthly SOC 2 evidence pack:

- Vercel env metadata showing `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` as Production sensitive variables with the cutover timestamp.
- Production redeploy ID and production alias timestamp.
- Unsigned webhook probe result `status=400`.
- Stripe live webhook endpoint URL and subscribed event list.
- Stripe delivery success for at least one live event.
- Matching `stripe.*` audit event and subscription mirror evidence in Supabase after a real live event.

Do not archive raw `sk_live_`, `pk_live_`, or `whsec_` values.

## Rollback

Prefer pausing live checkout entry points before reverting provider secrets. If live delivery is broken:

1. Disable or hide production checkout actions.
2. Inspect Stripe delivery attempts for the live endpoint.
3. Restore the previous known-good Vercel production env values from the private secret store if the new live values are wrong.
4. Redeploy production again with `vercel redeploy`.
5. Replay only verified Stripe events after the endpoint and signing secret are correct.

Never roll production back to `sk_test_` or `pk_test_` while live checkout remains reachable.
