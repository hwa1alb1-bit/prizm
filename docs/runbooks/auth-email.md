# Auth Email Runbook

Source of truth for Supabase auth email delivery on
`pdftoexcelstatementconverter.com`. Update this file when SMTP, templates,
or DNS change.

## Production Supabase project

- Name: `prizm` (lowercase, us-east-1)
- Ref: `dcirauvtuvvokvcwczft`
- DB host: `db.dcirauvtuvvokvcwczft.supabase.co`
- A second `PRIZM` project (`uuqzudzkuyifakxfluap`, us-west-2) exists but
  is `INACTIVE`. Do not change settings there.

## Auth flow

User auth uses Supabase email + password with email confirmation on.
Sign-in uses PKCE via `@supabase/ssr` `createBrowserClient`. Password
recovery uses the **token-hash + verifyOtp** flow so the verifier
cookie is not required — the previous PKCE recovery flow failed when
the verifier cookie was missing on the click (different storage
partition, scanner prefetch, privacy mode), and the migration
eliminates that class of failure.

### Routes

- `app/auth/confirm/route.ts` — server-side `verifyOtp({ token_hash, type })`
  for recovery (and any other OTP email types when their templates are
  switched over). On error redirects to
  `/login?error=auth_callback_failed&error_description=...` and logs
  `[auth-confirm] verifyOtp failed` with `code/status/message/requestId`.
- `app/auth/callback/route.ts` — PKCE exchange + ops audit, retained
  for sign-in. On exchange error logs `[auth-callback]
  exchangeCodeForSession failed` and redirects to
  `/login?error=auth_callback_failed&error_description=...`.
- `app/auth/finish/page.tsx` — implicit-flow client handoff for any
  template not yet migrated to token-hash.
- `app/(auth)/login/page.tsx` — surfaces `?error=` from the callback so
  silent failures stop.

### Dashboard checks

In Supabase Studio for project `dcirauvtuvvokvcwczft`:

1. **Authentication → URL Configuration**
   - Site URL: `https://pdftoexcelstatementconverter.com`
   - Redirect URLs include:
     - `https://pdftoexcelstatementconverter.com/auth/callback`
     - `https://pdftoexcelstatementconverter.com/auth/confirm`
     - `https://pdftoexcelstatementconverter.com/auth/finish`
     - `https://pdftoexcelstatementconverter.com/reset`
     - `https://pdftoexcelstatementconverter.com/app`
   - Preview/staging URLs as needed.

2. **Authentication → Email Templates**
   - Replace the four templates with the rebranded HTML in
     `docs/email-templates/`. Paste, then click **Save changes** on each:
     - Confirm signup: `confirmation.html`
     - Magic link: `magic-link.html`
     - Invite user: `invite.html`
     - Reset password: `recovery.html`
   - The recovery template uses
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset`
     so the click hits our server route directly and runs
     `verifyOtp` server-side. The other three templates still use
     `{{ .ConfirmationURL }}` until they migrate.

3. **Authentication → Providers → Email**
   - `Enable email signup`: ON
   - `Confirm email`: ON (we keep this for billing/abuse signal)
   - `Secure email change`: ON

4. **Authentication → SMTP Settings** (custom)
   - Sender name: `StatementStudio`
   - Sender email: `noreply@pdftoexcelstatementconverter.com`
   - Host: `smtp.resend.com`
   - Port: `465` (SSL)
   - Username: `resend`
   - Password: Resend API key from
     https://resend.com/api-keys (use the `Supabase Auth` key, not the
     app `RESEND_API_KEY`).
   - Send a test email after saving.

## DNS for inbox delivery

File: `infra/cloudflare/pdftoexcelstatementconverter-com.zone`.

Required records (all already present except DKIM):

- SPF apex: `v=spf1 include:amazonses.com ~all`
  When SMTP routes through Resend, add `include:_spf.resend.com`:
  `v=spf1 include:amazonses.com include:_spf.resend.com ~all`
- DKIM: `resend._domainkey TXT "<actual Resend DKIM key>"`
  Currently the zone has the placeholder `REPLACE_WITH_RESEND_DKIM_VALUE`
  on line 66. Replace with the value from
  https://resend.com/domains → `pdftoexcelstatementconverter.com` →
  **DNS Records** → DKIM row. Copy the full TXT value, paste into the
  zone, deploy, verify with:
  `dig +short TXT resend._domainkey.pdftoexcelstatementconverter.com`
- DMARC: already present at `p=none` warm-up. After 7 days of clean
  DKIM + SPF alignment, raise to `p=quarantine`.

## One-off: backfill the two reported accounts

After SMTP + DKIM + templates are live, both reported users should be
able to complete a reset flow on their own. If they cannot, run the
following in Supabase SQL Editor (project `dcirauvtuvvokvcwczft`) as a
one-off admin action:

```sql
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email in ('oneoddbob@gmail.com', 'hw3.alberts93@gmail.com');
```

Both accounts were already confirmed at the time of writing (verified
2026-06-16), so this is a no-op safety net. The real unblock is the
recovery email flow now landing in inbox under StatementStudio branding.

Record the run inline below.

| Date | Operator | Reason |
| ---- | -------- | ------ |
| 2026-06-19 | Hank | Paste updated `recovery.html` (token-hash flow) into Supabase Studio Reset Password template after PR for `fix/auth-recovery-link` merges. |

## How to verify end-to-end (5 min)

1. Fresh incognito Gmail tab.
2. https://pdftoexcelstatementconverter.com/register → sign up with a
   throwaway address you control.
3. Inbox (not spam) shows email from
   `StatementStudio <noreply@pdftoexcelstatementconverter.com>` with the
   StatementStudio logo. Headers show `dkim=pass spf=pass dmarc=pass`.
4. Click the link → land on `/auth/callback` → forwarded to either
   `/app` (PKCE) or `/auth/finish` → `/app` (implicit).
5. Sign out, sign in with the same credentials → land on `/app`.
6. `/forgot-password` → email arrives in inbox → link → `/reset` → set
   new password → `/app`.
7. Sign out, sign in with the new password → `/app`.

If step 4 lands on `/login?error=auth_callback_failed`, the project
flow type or redirect URLs are still misconfigured — see dashboard
checks above.
