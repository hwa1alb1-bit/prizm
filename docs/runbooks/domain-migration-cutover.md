# Domain migration cutover — pdftoexcelstatementconverter.com

Companion runbook to the PRIZM domain migration plan (`plans/i-am-looking-to-federated-crab.md`). Wave 2 (code) ships in PR #71. This document tracks the operator steps that PR #71 cannot perform from CI.

## State at PR #71 merge

- Wave 2 (code + tests + docs + zone file + CORS) merged.
- New domain `pdftoexcelstatementconverter.com` registered at Cloudflare Registrar.
- Cloudflare zone for the new domain exists; nameservers `leonard.ns.cloudflare.com`, `liz.ns.cloudflare.com`.
- Vercel domains attached: `pdftoexcelstatementconverter.com` + `www.pdftoexcelstatementconverter.com` on project `prj_PcZSm3UYukEIrL1LxsbdrRuiPaos`. Both show `Invalid Configuration` pending DNS.
- Vercel env `NEXT_PUBLIC_SITE_URL` still points to `https://prizmview.app`. Do NOT change yet.
- Resend, Supabase, Stripe untouched.

## Wave 1 — Cloudflare DNS + Resend warm-up

Long pole: Resend DKIM verification = 24–48h. Start here.

### W1.1 — Resend domain add

1. Resend dashboard → Domains → Add Domain → `pdftoexcelstatementconverter.com`.
2. Capture the DKIM TXT value Resend displays.
3. Replace the placeholder `"REPLACE_WITH_RESEND_DKIM_VALUE"` in `infra/cloudflare/pdftoexcelstatementconverter-com.zone` line 67 with the real value. Long DKIM values may be split into 255-character chunks separated by spaces inside the same TXT record.

### W1.2 — Cloudflare zone import

Cloudflare dash → `pdftoexcelstatementconverter.com` → DNS → Records → Advanced → Import and Export → Import DNS Records → upload `infra/cloudflare/pdftoexcelstatementconverter-com.zone`.

After import (MANDATORY):

- [ ] Apex `A` record proxy status → DNS-ONLY (gray cloud). Vercel TLS fails if proxied.
- [ ] `www` CNAME proxy status → DNS-ONLY.
- [ ] `resend._domainkey` TXT contains the real DKIM value, not the placeholder.
- [ ] DNS → Settings → DNSSEC → Enable. Copy the DS record values; they get added at the registrar in W1.5.

### W1.3 — Resend verification

Wait for Resend dashboard to mark domain `Verified`. Typical window 1h–48h depending on propagation. Then send a test email from `noreply@pdftoexcelstatementconverter.com` to a personal inbox and confirm:

- Inbox placement (not Spam/Junk).
- DKIM and SPF show `pass` in raw headers.

### W1.4 — AWS SES inbound

```powershell
.\infra\aws\setup-ses-inbound.ps1 -Region us-east-1
```

Recipients list already updated to include both old + new domain mailboxes.

### W1.5 — DNSSEC DS at registrar

Since the new domain is registered AT Cloudflare, DNSSEC propagation happens automatically once enabled in step W1.2. Verify with:

```powershell
Resolve-DnsName pdftoexcelstatementconverter.com -Type DS
```

Gate G1: DKIM verified at Resend, DNSSEC DS resolves, MX + SPF + DMARC + DKIM all `dig`-visible.

## Wave 3 — Dual-domain live

### W3.1 — Vercel domains

Already attached. Confirm by running:

```powershell
npx vercel domains inspect pdftoexcelstatementconverter.com --scope plknokos-projects
npx vercel domains inspect www.pdftoexcelstatementconverter.com --scope plknokos-projects
```

After Wave 1 DNS lands, both should show `Edge Network: yes` and a valid Let's Encrypt certificate (1–5 min after first DNS-only record resolves).

### W3.2 — Supabase auth redirect URLs

Supabase dashboard → project `dcirauvtuvvokvcwczft` → Authentication → URL Configuration → Redirect URLs. Add:

- `https://pdftoexcelstatementconverter.com/**`
- `https://www.pdftoexcelstatementconverter.com/**`

Do NOT yet change Site URL. Keep `prizmview.app` redirects in the allowlist for 30+ days after cutover.

### W3.3 — Stripe webhook duplicate

Stripe dashboard (test mode, account `acct_1TRZFv44hvL1QSxT`) → Developers → Webhooks → Add endpoint:

- URL: `https://pdftoexcelstatementconverter.com/api/v1/webhooks/stripe`
- Events: same as the existing prizmview.app endpoint (`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, plus any others the current endpoint subscribes to).
- Copy the new `whsec_*` and add to Vercel env as `STRIPE_WEBHOOK_SECRET` (rotated at cutover) or `STRIPE_WEBHOOK_SECRET_NEW` (parallel).

Verify both endpoints receive a synthetic event from `stripe trigger checkout.session.completed`.

### W3.4 — Smoke test on new domain

After Wave 1 DNS is live + cert provisioned:

1. Visit `https://pdftoexcelstatementconverter.com/register` from an incognito window.
2. Enter a fresh email. Confirm magic-link email arrives from `noreply@pdftoexcelstatementconverter.com`.
3. Click link, complete callback, land on `/app`.
4. Trigger a Stripe Checkout (test mode). Confirm webhook delivery in both endpoints.
5. Confirm Supabase auth.users row created.

Gate G3: full signup → checkout flow completes on the new domain with no regressions.

## Wave 4 — Cutover (only after G3 passes)

In Vercel Production env, flip:

- `NEXT_PUBLIC_SITE_URL` → `https://pdftoexcelstatementconverter.com`
- `RESEND_FROM_EMAIL` → `noreply@pdftoexcelstatementconverter.com`

Redeploy (Vercel triggers automatically on env change).

Then in Supabase → Auth → URL Configuration → Site URL → `https://pdftoexcelstatementconverter.com`. Leave redirect allowlist with both entries.

Add a Next.js permanent redirect from `prizmview.app/*` to `pdftoexcelstatementconverter.com/*` preserving path + query.

Stripe dashboard → Settings → Business Settings → Public Details → website + support email → new domain.

Gate G4: hitting `https://prizmview.app/app` 301-redirects to `https://pdftoexcelstatementconverter.com/app`. New signups receive mail from the new domain.

## Rollback at each gate

| Gate | Rollback |
|------|----------|
| G1 | Fix DKIM TXT, re-verify; no production impact. |
| G2 (this PR) | Revert PR #71; both domains still resolve to same Vercel deployment. |
| G3 | Remove `pdftoexcelstatementconverter.com` from Vercel project domains; Supabase + Stripe untouched. |
| G4 | Revert Vercel env vars and Supabase Site URL; old domain still serves. |

## What this runbook does NOT cover

- Wave 5 (Search Console change-of-address, DMARC progression `p=none` → `p=quarantine` → `p=reject`) — separate runbook.
- Wave 6 (teardown of `prizmview.app` after 30+ days) — separate runbook.
- Sentry org slug rename — explicitly out of scope per plan line 178.
