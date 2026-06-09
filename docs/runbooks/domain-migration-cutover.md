# Domain migration cutover — pdftoexcelstatementconverter.com

Companion runbook to the PRIZM domain migration plan (`plans/i-am-looking-to-federated-crab.md`). Wave 2 (code) shipped in PR #71.

**Update 2026-06-04**: Hank confirmed PRIZM is pre-launch (3 internal Supabase accounts, sandbox Stripe, no SEO history, prizmview.app never live-attached at Vercel). The original plan's dual-domain transition window is overkill. This runbook reflects a full purge of prizmview.app from PRIZM, freeing the domain for reuse on a different personal project.

## State at PR #71 (with purge commit) merge

- Wave 2 (code + tests + docs + zone file + CORS) merged.
- prizmview.app fully removed from PRIZM code, CORS allowlists, SES recipient list, REQUIRED_RELEASE_HOSTS, and the old zone file.
- New domain `pdftoexcelstatementconverter.com` registered at Cloudflare Registrar. Zone exists. Nameservers `leonard.ns.cloudflare.com`, `liz.ns.cloudflare.com`.
- Vercel domains attached: `pdftoexcelstatementconverter.com` + `www.*` on project `prj_PcZSm3UYukEIrL1LxsbdrRuiPaos`. Both show `Invalid Configuration` pending DNS.
- prizmview.app never attached at Vercel. Nothing to detach.
- Vercel env `NEXT_PUBLIC_SITE_URL` and `RESEND_FROM_EMAIL` need flipping at Wave 4.

## Wave 1 — Cloudflare DNS + Resend warm-up

Long pole: Resend DKIM verification = 24-48h.

### W1.1 — Resend domain add

1. Resend dashboard, Domains, Add Domain, `pdftoexcelstatementconverter.com`, region `us-east-1`.
2. Capture the DKIM TXT value Resend displays.
3. Replace the placeholder `"REPLACE_WITH_RESEND_DKIM_VALUE"` in `infra/cloudflare/pdftoexcelstatementconverter-com.zone` with the real value.

### W1.2 — Cloudflare zone import

Cloudflare dash, `pdftoexcelstatementconverter.com`, DNS, Records, Advanced, Import and Export, Import DNS Records, upload the zone file.

After import (mandatory):

- [ ] Apex `A` record proxy status to DNS-ONLY (gray cloud).
- [ ] `www` CNAME proxy status to DNS-ONLY.
- [ ] `resend._domainkey` TXT contains the real DKIM value.
- [ ] DNSSEC enabled.

### W1.3 — Resend verification

Wait for Resend to mark domain Verified. Send a test email from `noreply@pdftoexcelstatementconverter.com` to confirm DKIM and SPF pass.

### W1.4 — AWS SES inbound

```powershell
.\infra\aws\setup-ses-inbound.ps1 -Region us-east-1
```

Recipients list reflects new-domain mailboxes only.

Gate G1: DKIM verified, DNSSEC DS resolves, MX + SPF + DMARC + DKIM all `dig`-visible.

## Wave 3 — Smoke + cutover prep

### W3.1 — Vercel domains

Already attached. Verify:

```powershell
npx vercel domains inspect pdftoexcelstatementconverter.com --scope plknokos-projects
npx vercel domains inspect www.pdftoexcelstatementconverter.com --scope plknokos-projects
```

Should show `Edge Network: yes` and a valid Let's Encrypt certificate within 5 minutes of Wave 1 DNS landing.

### W3.2 — Supabase auth

Supabase dashboard, project `dcirauvtuvvokvcwczft`, Authentication, URL Configuration:

- **Site URL**: `https://pdftoexcelstatementconverter.com`
- **Redirect URLs**: `https://pdftoexcelstatementconverter.com/**` and `https://www.pdftoexcelstatementconverter.com/**`
- Remove any prizmview.app entries.

### W3.3 — Stripe webhook

Stripe dashboard (test mode, account `acct_1TRZFv44hvL1QSxT`), Developers, Webhooks:

- Edit the existing `https://prizmview.app/api/v1/webhooks/stripe` endpoint, change URL to `https://pdftoexcelstatementconverter.com/api/v1/webhooks/stripe`. Stripe preserves the existing `whsec_*` so no env rotation needed.
- Or delete + re-create. If re-creating, copy the new `whsec_*` and update `STRIPE_WEBHOOK_SECRET` in Vercel env.

### W3.4 — Smoke test

After Wave 1 DNS + cert provisioned:

1. Incognito browser to `https://pdftoexcelstatementconverter.com/register`.
2. Magic-link signup with a fresh email. Confirm mail arrives from `noreply@pdftoexcelstatementconverter.com`.
3. Stripe Checkout (test mode). Webhook delivery green.
4. Confirm Supabase auth.users row created.

Gate G3: full signup + checkout flow completes.

## Wave 4 — Cutover

Vercel Production env vars:

- `NEXT_PUBLIC_SITE_URL` to `https://pdftoexcelstatementconverter.com` (or unset; code default already correct).
- `RESEND_FROM_EMAIL` to `noreply@pdftoexcelstatementconverter.com` (or unset; code default already correct).

Redeploy.

Stripe Settings, Business Settings, Public Details: website + support email to new domain.

Gate G4: production runs on new domain end to end.

## Wave 5 — prizmview.app release

Per Hank's decision (2026-06-04), prizmview.app is being repurposed for a personal work dashboard. Steps:

1. Cloudflare dashboard, prizmview.app zone, DNS Records: delete all PRIZM-era records (apex A, www CNAME, send MX, send TXT, apex TXT, resend.\_domainkey TXT, \_dmarc TXT). Leave the zone itself; it stays usable for the new project.
2. Resend dashboard, Domains: delete `prizmview.app`.
3. AWS SES, Email Receiving, Rule Sets, `prizm-inbound`: edit the rule and remove all `@prizmview.app` recipients. Or disable the rule entirely if the new project does not need SES inbound.
4. Stripe webhook for prizmview.app: deleted in Wave 3.
5. Cloudflare Registrar, prizmview.app, renewal date: leave on auto-renew so the personal dashboard project keeps the domain.

The Cloudflare zone for prizmview.app stays empty until the new project builds it from scratch.

## Rollback per gate

| Gate        | Rollback                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1          | Fix DKIM TXT, re-verify. No production impact.                                                                                                                                     |
| G2 (PR #71) | Revert PR. No live state changed.                                                                                                                                                  |
| G3          | Remove pdftoexcelstatementconverter.com from Vercel domains; Supabase + Stripe untouched.                                                                                          |
| G4          | Restore prior Vercel env vars and Supabase Site URL. Old domain is already torn down; revert by restoring prizmview.app DNS + Vercel attach + Resend domain. About 1 hour of work. |
