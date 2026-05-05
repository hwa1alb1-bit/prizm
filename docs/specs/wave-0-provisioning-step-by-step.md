# Wave 0 Provisioning: Step-by-Step

## Verified state as of 2026-04-29

Post-investigation snapshot of all 10 Wave 0 items. Score: 0 of 10 fully closed. 5 Partial (1, 2, 3, 6, plus Sentry-local). 5 Outstanding externally (4, 5, 7, 9, 10). The click-by-click instructions below remain accurate for the home-desktop bring-up.

| #   | Item                   | Status                 | Verified facts                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Domain `prizmview.app` | PARTIAL                | Zone imported at Cloudflare. DNS resolving. Apex A record proxied (must be DNS-only). DKIM TXT still equals literal `REPLACE_WITH_RESEND_DKIM_VALUE`. DNSSEC unverified.                                                                                                                                                                                                             |
| 2   | GitHub repo            | PARTIAL                | `PLKNoko/prizm` private. `main` pushed at `3c0f9b06`. CI workflow registered. Branch protection blocked by Free plan for private repos. CODEOWNERS missing. 0 Actions secrets.                                                                                                                                                                                                       |
| 3   | Supabase               | PARTIAL                | Project `dcirauvtuvvokvcwczft` ACTIVE_HEALTHY us-east-1 Postgres 17.6.1.111. 8 of 8 tables. RLS on all 8. 11 policies. 2 migrations applied (0001 schema, 0002 trigger rename + search_path harden). Bootstrap trigger lives under canonical name `on_auth_user_created` and was verified post-apply via `pg_trigger`. PITR not visible via MCP. Service role key not in Vercel env. |
| 4   | Vercel                 | OUTSTANDING            | Team `plknokos-projects` confirmed. Zero projects. Zero deployments.                                                                                                                                                                                                                                                                                                                 |
| 5   | AWS                    | OUTSTANDING            | AWS CLI not installed (`aws --version` exit 127). aws-api MCP connected but no host credentials.                                                                                                                                                                                                                                                                                     |
| 6   | Stripe                 | PARTIAL                | Sandbox `acct_1TRZFv44hvL1QSxT` livemode false. 4 products + 4 subscription prices verified. Overage product has no price (needs billing meter via `pnpm seed:stripe`). Webhook endpoint, Customer Portal, billing meter unverifiable through MCP.                                                                                                                                   |
| 7   | Resend                 | OUTSTANDING            | DNS structure correct (uses SES-backed records as Resend expects). DKIM placeholder unreplaced. `RESEND_API_KEY` not in `.env.local`. Domain not verified in Resend dashboard.                                                                                                                                                                                                       |
| 8   | Sentry                 | OUTSTANDING externally | No account, no project, no DSN. Wrapper `lib/server/sentry.ts` ready as no-op until DSN set. No init files needed for Wave 0.                                                                                                                                                                                                                                                        |
| 9   | Upstash Redis          | OUTSTANDING            | DB `close-stag-109648` exists per docs. Token compromised in chat earlier, must rotate. URL and token not in `.env.local`.                                                                                                                                                                                                                                                           |
| 10  | Mailboxes              | OUTSTANDING            | Apex MX record absent. Inboxes cannot receive mail.                                                                                                                                                                                                                                                                                                                                  |

`.env.local` does not exist on this dev machine. Local dev cannot start until it is created.

## What is wrong right now

Five concrete defects to fix before declaring Wave 0 closed.

1. **Cloudflare apex A record proxied.** Switch the apex `prizmview.app` A record to DNS-only (gray cloud) at Cloudflare. Vercel anycast `76.76.21.21` requires direct DNS, not proxy.
2. **Resend DKIM TXT placeholder unreplaced.** The DKIM record still equals literal string `REPLACE_WITH_RESEND_DKIM_VALUE`. Pull the real DKIM value from the Resend dashboard and overwrite the TXT record at Cloudflare.
3. ~~**Supabase `on_auth_user_created` trigger missing.**~~ FIXED 2026-04-29 in commit `6f65087`. Investigation showed migration 0001 had created the trigger under the name `auth_user_bootstrap_workspace`. Functional, but a verification query that filtered by canonical name `on_auth_user_created` returned 0 and looked like a missing trigger. Migration 0002 renamed it to the canonical name, replaced the function with a `SET search_path = public, pg_temp` variant, and revoked EXECUTE from `public`, `anon`, `authenticated` so only the trigger context invokes it. Verified live with `pg_trigger` query post-apply.
4. **GitHub branch protection plan-gated.** Free plan blocks branch protection on private repos. Either upgrade `PLKNoko` to GitHub Pro or accept the gap and document the workaround until the org moves to a paid plan.
5. **No `.env.local` on host.** Run `cp .env.example .env.local` in `PRIZM/product/`, then paste secrets from the password manager into the new file before `pnpm dev`.

A sixth host gap also blocks AWS work: AWS CLI is not installed. Install via `winget install Amazon.AWSCLI` or the MSI installer at https://awscli.amazonaws.com/AWSCLIV2.msi, then run `aws configure sso` against the prizm Identity Center URL.

---

Click-by-click walkthrough for items 1, 3, 4, 5, 6, 7, 8, 9 of the Wave 0 Provisioning Handoff. Items 2 (GitHub repo) and 10 (mailboxes) intentionally skipped per scope.

## Pre-flight checklist (have these ready)

- A working credit or debit card with $50 of available headroom (you will spend cents in Phase 1, but trust providers want a card on file)
- Access to your email inbox for verification links
- A password manager (Bitwarden, 1Password, KeePass) for storing the secrets you will collect
- A scratch text file for env-var values as you collect them, to copy-paste into Vercel later
- Two browser windows: one for the vendor consoles, one for `~/.claude/plans/use-specialized-sub-agents-nifty-torvalds.md` so you have the design context next to you

## Recommended order (start the slow ones first)

| Order | Step                                          | Time                       | Why this order                                                   |
| ----- | --------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| 1     | Stripe identity verification kickoff          | 5 min start, 1-3 days wait | Verification runs in the background while you do everything else |
| 2     | Domain registration                           | 15 min                     | DNS records for Vercel and Resend depend on the domain           |
| 3     | Sentry                                        | 10 min                     | Independent, fast, paste DSN into your scratch file              |
| 4     | Upstash Redis                                 | 10 min                     | Independent, fast                                                |
| 5     | Supabase                                      | 20 min                     | Independent                                                      |
| 6     | AWS Organization + S3 + KMS + Textract + OIDC | 90 to 120 min              | Most complex, do when uninterrupted                              |
| 7     | Resend                                        | 15 min                     | Needs the domain for DKIM/SPF                                    |
| 8     | Vercel                                        | 30 min                     | Needs the GitHub repo (your separate item 2) and the domain      |
| 9     | Stripe products + webhook + Customer Portal   | 30 min                     | Once Stripe identity verifies, do products in test mode first    |

Total focused time: about 4 to 6 hours. Calendar time bounded by Stripe identity verification.

You can do steps 3, 4, 5, 6, 7, 8 in parallel if you have help.

---

## 1. Domain (`prizmview.app`)

### What you are doing

Registering the apex domain that everything else hangs off, with DNSSEC and registrar lock turned on.

### Pre-flight

- Pick the registrar. Recommended: **Cloudflare Registrar** (at-cost pricing, free WHOIS privacy, one-click DNSSEC). Acceptable alternates: Porkbun, Namecheap.
- Have a payment card ready.

### Steps

1. Go to https://dash.cloudflare.com/registrar (or your registrar of choice).
2. Search `prizmview.app`.
3. If taken, fall back in this order: `tryprizmview.app`, `prizm.io`, `prizm.so`, `getprizm.com`. Update env vars accordingly later.
4. `.app` is an HSTS-preloaded TLD, which means the browser refuses HTTP. This is a feature for trust posture, not a problem.
5. Add to cart, expect about $14 to $20 for one year.
6. Checkout. Auto-renew ON.
7. Open the domain in your registrar dashboard.
8. **DNSSEC**: enable. Cloudflare: one click. Other registrars: copy the DS records into the registry.
9. **Registrar lock** (also called "transfer lock"): enable.
10. **2FA on the registrar account**: enable. TOTP via authenticator app, not SMS.
11. **WHOIS privacy**: confirm enabled (free at Cloudflare; some registrars charge).

### Verify

```bash
dig prizmview.app +dnssec | grep -E '^(prizmview.app|;.*RRSIG)'
```

You expect to see `RRSIG` records.

```bash
dig prizmview.app NS
```

Returns the registrar's nameservers (e.g. `*.ns.cloudflare.com`).

### Capture

- Domain registered: prizmview.app
- Registrar: <name>
- DNSSEC: enabled
- Lock: enabled

### Gotchas

- `.app` requires HTTPS. All Vercel deploys are HTTPS by default, so this is fine.
- If you used a non-Cloudflare registrar, change nameservers to Cloudflare DNS later for free DNSSEC and easier record management. Cloudflare DNS is free even if the registrar is elsewhere.

---

## 3. Supabase project

### What you are doing

Creating two Supabase projects (`prizm-staging` and `prizm-prod`) with Postgres, Auth, and PITR. Capturing the URLs and keys for env vars.

### Pre-flight

- Sign up at https://supabase.com using the email you will use for the project owner.
- Recommend signing in with GitHub for easier later integration.
- Plan choice: **Free tier for dev**, **Pro ($25/month) for prod**. Pro unlocks PITR, daily backups, and 100 GB egress.

### Steps (do this twice, once for staging, once for prod)

1. Go to https://supabase.com/dashboard.
2. Click **New project**.
3. Organization: create one called `prizm` if it does not exist. Otherwise pick it.
4. Name: `prizm-staging` (or `prizm-prod`).
5. Database password: click Generate, copy it to your password manager. Label it "Supabase prizm-staging DB password".
6. Region: `us-east-1` (default) for staging and prod. Switch to `eu-west-1` per environment if you have an EU customer driving residency.
7. Plan: Free for staging, **Pro for prod**.
8. Click **Create new project**. Wait about 2 minutes.

Once the project is ready:

9. Settings → API.
10. Copy `Project URL` (looks like `https://abc123.supabase.co`).
11. Copy `anon` `public` key (long JWT starting `eyJh`). This is safe in client code.
12. Copy `service_role` `secret` key (also `eyJh`). **Server-only**. Never paste in client code or commit.
13. Settings → Database → Connection pooling. Copy the pooled connection string for migrations.
14. Settings → Auth → URL Configuration:
    - Site URL: `https://prizmview.app` (production project), `https://staging.prizmview.app` or your Vercel preview URL (staging project).
    - Redirect URLs: add the same plus `http://localhost:3030` for local dev.
15. Settings → Auth → Email:
    - Confirm signups: ON (we want email verification)
    - Secure email change: ON
    - Mailer: leave default for now. Wave 1 swaps to Resend SMTP.
16. Settings → Auth → Providers → Email:
    - Enable Email provider
    - Enable magic link
    - Disable phone provider (we are not using SMS)
17. Settings → Backups (Pro only): enable Point in Time Recovery (PITR), set retention to 7 days.

### Verify

In your scratch file, you should now have:

```
NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

Smoke test (after we apply migration 0001 in Wave 1):

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/workspace?limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expect a 200 with empty array `[]` until the first user signs up. RLS is on, so no rows leak.

### Capture

- Project URL (staging + prod)
- Anon key (staging + prod)
- Service role key (staging + prod)
- DB password (staging + prod), password manager only

### Gotchas

- The Supabase service-role key bypasses RLS. Treat it like an AWS root key. Server-only.
- Free tier projects pause after 1 week of inactivity. Pro stays awake.
- `auth.users` is Supabase's internal table. Our schema's `user_profile` references it via FK and the bootstrap trigger creates the workspace row.

---

## 4. Vercel project

### What you are doing

Linking the GitHub repo (your separate item 2) to a Vercel project, attaching the custom domain, partitioning environment variables across production / preview / development.

### Pre-flight

- GitHub repo `PLKNoko/prizm` exists with the local `PRIZM/product/` commits pushed.
- Domain `prizmview.app` registered (item 1).
- Vercel account at https://vercel.com signed in with GitHub.
- All the env vars you've collected so far in your scratch file.

### Steps

1. Go to https://vercel.com/new.
2. Import GitHub repo `PLKNoko/prizm`. (You may need to grant Vercel access to the repo via the GitHub integration.)
3. Framework Preset: **Next.js** (auto-detected).
4. Root Directory: `./` (the repo root, since `PRIZM/product/` was pushed as the repo root).
5. Build & Output Settings: defaults are fine.
6. **Environment Variables**: paste from your scratch file. Add each one for `Production`, `Preview`, `Development` (you can pick "All Environments" then override per-env later for secrets you want to differ).
   - `NEXT_PUBLIC_SUPABASE_URL` (different per environment)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (different per environment)
   - `SUPABASE_SERVICE_ROLE_KEY` (different per environment, **server-only** so mark "Sensitive")
   - `NEXT_PUBLIC_SITE_URL` (https://prizmview.app for prod, https://staging.prizmview.app for preview)
   - Leave AWS, Stripe, Resend, Sentry, Upstash blank for now; you will fill them as you provision each.
7. Click **Deploy**. First deploy takes 2-3 minutes.
8. Once deployed, go to Settings → Domains.
9. Add `prizmview.app`. Vercel shows the records to add at your registrar.
10. At your registrar, add:
    - `A` record on apex `@` pointing to `76.76.21.21` (Vercel anycast)
    - `CNAME` on `www` pointing to `cname.vercel-dns.com`
11. Wait 1 to 5 minutes for SSL provisioning.
12. Optionally add `staging.prizmview.app` later when staging Vercel project is set up.
13. Settings → Git → Production Branch: `main`.
14. Settings → Git → Ignored Build Step: `git diff --quiet HEAD^ HEAD ./` (skips rebuilds when nothing changed).
15. Settings → Cron Jobs: leave for Wave 2 (deletion sweep + monitor cron land there).
16. (After Wave 1 runs) Settings → Functions → Region: pin to `iad1` (us-east-1) to match S3.

### OIDC connection to AWS (do this after item 5)

17. Settings → Environment Variables → add `VERCEL_OIDC_TOKEN` if your AWS SDK code expects a name other than the default. The Vercel runtime injects an OIDC JWT automatically; your AWS SDK code uses `@aws-sdk/credential-provider-web-identity` to exchange it.

### Verify

```bash
curl -I https://prizmview.app
```

Expect:

```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
content-security-policy: ...
```

(Strict-Transport-Security comes from Vercel by default; CSP is set in Wave 2 by B4 Security Engineer.)

### Capture

- Vercel project linked to GitHub
- prizmview.app live with HTTPS
- VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID for CI (under Account Settings → Tokens, then Project Settings → General for IDs)

### Gotchas

- Don't paste secrets via the UI from a password manager that adds whitespace. Use Vercel CLI (`vc env add NAME`) to avoid invisible characters.
- After custom domain is live, redeploy once so HSTS preload eligibility kicks in (`max-age=63072000` plus `preload`).
- Preview deployments use the Preview env vars, not Production. Mismatched envs are a common Phase-1 footgun.

---

## 5. AWS Organization + S3 + KMS + Textract + Vercel OIDC

### What you are doing

Creating a dedicated AWS Organization with two sub-accounts (prizm-prod and prizm-staging), provisioning S3 + KMS + Textract per account, and configuring Vercel-to-AWS OIDC role assumption so Vercel functions never hold static AWS keys.

### Pre-flight

- A fresh AWS root account is recommended. Don't reuse a personal account if you can avoid it. Create a new one at https://aws.amazon.com/ with email `aws-root@prizmview.app` (alias to your real email).
- Hardware MFA key recommended for the root account (YubiKey, Titan).
- Allow about 2 hours of focused time.

### Part A. Organization + sub-accounts

1. Sign in to AWS Console as root.
2. Search "Organizations" → open AWS Organizations.
3. Click **Create an organization** → choose **Enable all features**.
4. **Add an AWS account**:
   - Account name: `prizm-prod`
   - Email: `aws-prod@prizmview.app` (must be a real email; use alias)
   - IAM role name: `OrganizationAccountAccessRole` (default)
5. Repeat for `prizm-staging` with email `aws-staging@prizmview.app`.
6. Create OUs:
   - **Organize accounts** → Create new OU `Production`, move `prizm-prod` in.
   - Create OU `NonProduction`, move `prizm-staging` in.
7. **Service Control Policies**: enable in **Policies → Service control policies**. Apply `FullAWSAccess` (default) for now; harden in Phase 2.

### Part B. IAM Identity Center (single sign-on)

8. Search "IAM Identity Center" → enable in your home region (`us-east-1`).
9. **Identity source**: Identity Center directory (default).
10. **Users** → Add user → yourself, with your email and a strong username.
11. **Permission sets** → Create:
    - Name: `PrizmAdmin`, Policies: `AdministratorAccess`, Session: 8 hours.
    - (Later, for the team) Name: `PrizmDeveloper`, Policies: `PowerUserAccess`.
12. **AWS accounts** tab → assign your user `PrizmAdmin` to both `prizm-prod` and `prizm-staging`.
13. **Settings** → MFA → Require MFA for sign-in → Always.
14. Sign out of root.
15. Sign in via the IAM Identity Center URL (it's at `https://<your-org>.awsapps.com/start`). Configure MFA on first login.
16. Lock root: enable hardware MFA on root, store the MFA device offline, never use root again unless you have to.

### Part C. Sub-account work, staging first then prod

From now on, switch into `prizm-staging` via Identity Center.

#### KMS Customer-Managed Key

17. Console → KMS → **Customer managed keys** → **Create key**.
18. Key type: **Symmetric**, Key usage: **Encrypt and decrypt**.
19. **Advanced options**: Key spec `SYMMETRIC_DEFAULT`, Origin `KMS`, **Multi-Region key** ON.
20. Alias: `prizm-uploads-staging`.
21. Description: "PRIZM upload encryption key for staging".
22. **Define key administrators**: select your IAM Identity Center user.
23. **Define key usage permissions**: leave empty for now. You will edit the policy after creating the Vercel role.
24. Review and finish. **Copy the Key ARN**.

#### S3 bucket

25. Console → S3 → **Create bucket**.
26. Bucket name: `prizm-uploads-staging` (must be globally unique; fall back to `prizm-uploads-staging-<digits>` if taken).
27. AWS Region: `us-east-1`.
28. **Object Ownership**: ACLs disabled. **Bucket owner enforced**.
29. **Block all public access**: ON, all four sub-options checked.
30. **Bucket Versioning**: Disable.
31. **Default encryption**: SSE-KMS, choose the alias `alias/prizm-uploads-staging`.
32. **Bucket Key**: Enabled.
33. Create bucket.
34. Open bucket → **Management** tab → **Lifecycle rules** → Create rule.
35. Rule name: `expire-uploads-1-day`.
36. Scope: **Apply to all objects in the bucket**.
37. Actions: **Expire current versions of objects**. Days after object creation: **1**.
38. Also: **Delete expired object delete markers**, **Delete incomplete multipart uploads after 1 day**.
39. Save.
40. **Permissions** tab → **Cross-origin resource sharing (CORS)** → Edit:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://prizmview.app", "https://*.vercel.app", "http://localhost:3030"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

41. Save.

#### OIDC provider for Vercel

42. Console → IAM → **Identity providers** → **Add provider**.
43. Provider type: **OpenID Connect**.
44. Provider URL: `https://oidc.vercel.com/<TEAM_SLUG>` (find your team slug at https://vercel.com/account → Team).
45. Audience: `https://vercel.com/<TEAM_SLUG>`.
46. **Get thumbprint** → AWS auto-fetches.
47. Add provider.

#### IAM Role for Vercel

48. Console → IAM → **Roles** → **Create role**.
49. Trusted entity type: **Web identity**.
50. Identity provider: select `oidc.vercel.com/<TEAM_SLUG>`.
51. Audience: `https://vercel.com/<TEAM_SLUG>`.
52. (Optional but recommended) Conditions on `oidc.vercel.com/<TEAM_SLUG>:sub`: starts-with `owner:<TEAM_SLUG>:project:prizm:environment:`. This restricts the role to your specific Vercel project.
53. **Attach an inline policy** (next page):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Uploads",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::prizm-uploads-staging/*"
    },
    {
      "Sid": "KMSEncryptDecrypt",
      "Effect": "Allow",
      "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"],
      "Resource": "<KMS_KEY_ARN_FROM_STEP_24>"
    },
    {
      "Sid": "Textract",
      "Effect": "Allow",
      "Action": [
        "textract:StartDocumentAnalysis",
        "textract:GetDocumentAnalysis",
        "textract:StartDocumentTextDetection",
        "textract:GetDocumentTextDetection"
      ],
      "Resource": "*"
    }
  ]
}
```

54. Role name: `vercel-prizm-staging-role`.
55. Create role. **Copy the Role ARN**.

#### KMS key policy update

56. Back to KMS → key `prizm-uploads-staging` → **Key policy** → **Edit** → **Switch to policy view**.
57. Add a statement granting the Vercel role decrypt and encrypt:

```json
{
  "Sid": "AllowVercelRole",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::<ACCOUNT_ID>:role/vercel-prizm-staging-role"
  },
  "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"],
  "Resource": "*"
}
```

58. Save.

#### Vercel side: tell Vercel to assume this role

59. In Vercel project → Settings → Environment Variables, add:

```
AWS_ROLE_ARN=arn:aws:iam::<ACCOUNT_ID>:role/vercel-prizm-staging-role
AWS_REGION=us-east-1
S3_UPLOAD_BUCKET=prizm-uploads-staging
S3_KMS_KEY_ID=<KMS_KEY_ARN>
```

60. The AWS SDK (with `@aws-sdk/credential-provider-web-identity`) reads these and exchanges the Vercel-injected OIDC token for short-lived AWS creds at runtime. No static AWS access keys.

### Part D. Repeat in prizm-prod

61. Switch to `prizm-prod` account via Identity Center.
62. Repeat steps 17 through 60 with names changed:
    - KMS alias: `prizm-uploads-prod`
    - S3 bucket: `prizm-uploads-prod`
    - IAM role: `vercel-prizm-prod-role`
    - Vercel env vars on Production environment

### Verify

From a Vercel preview deploy with the staging env vars:

```typescript
// app/api/health/route.ts (temporary diagnostic)
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { fromWebToken } from '@aws-sdk/credential-provider-web-identity'

export async function GET() {
  const sts = new STSClient({
    region: process.env.AWS_REGION,
    credentials: fromWebToken({
      roleArn: process.env.AWS_ROLE_ARN!,
      webIdentityToken: process.env.VERCEL_OIDC_TOKEN!,
      roleSessionName: 'prizm-healthcheck',
    }),
  })
  const out = await sts.send(new GetCallerIdentityCommand({}))
  return Response.json(out)
}
```

Hit `/api/health` on a Vercel preview. You expect to see the assumed-role ARN come back.

Bucket round trip: upload a 1-byte file via presigned PUT, wait 25 hours, run `aws s3 ls s3://prizm-uploads-staging/` and confirm zero objects. (Lifecycle expires once-daily; the cron sweep we build in Wave 2 covers the gap.)

### Capture

- 12 AWS env vars (6 per environment, 2 environments):

```
AWS_REGION=us-east-1
AWS_ROLE_ARN=<role ARN per env>
S3_UPLOAD_BUCKET=<bucket per env>
S3_KMS_KEY_ID=<KMS ARN per env>
```

### Gotchas

- The OIDC provider URL **must** match the Vercel team slug exactly. If you mistype, AWS rejects the JWT silently (debug via CloudTrail).
- Multi-region KMS keys cost slightly more but the replicated key in another region is what saves you in F10 (regional outage).
- Don't grant `s3:*` on `arn:aws:s3:::*`. Scope tightly to the upload bucket.
- The 30-day deletion lock on KMS is set at the time you `ScheduleKeyDeletion`, not at create time. Document in the runbook that scheduled deletion uses 30-day waiting period.

---

## 6. Stripe (products + webhook + Customer Portal)

### What you are doing

Setting up your Stripe account in test mode, kicking off identity verification for live mode in the background, creating products and prices, configuring Customer Portal, registering the webhook.

### Pre-flight

- Sign up at https://stripe.com.
- Have business info ready: legal name, EIN/SSN, business address, bank account.
- Identity verification takes 1 to 3 business days. Start now.

### Part A. Account + identity

1. Sign up.
2. **Settings → Account details**: complete business info.
3. **Settings → Bank accounts and scheduling**: add bank account for payouts.
4. **Settings → Tax**: register tax IDs (state sales tax if applicable, or use Stripe Tax).
5. **Settings → Public details**: business name `PRIZM`, website `https://prizmview.app`, support email `support@prizmview.app`.
6. Identity verification will run in the background. You'll get an email when it clears.

### Part B. Test-mode products and prices

Toggle **Test mode** at top right. Do all setup in test mode first.

7. **Products → Add product** → Free
   - Name: PRIZM Free
   - Pricing model: Standard pricing
   - Price: $0.00 USD, billing period Monthly, Recurring
   - Save and copy the price ID (`price_...`)
8. **Products → Add product** → Starter
   - Name: PRIZM Starter
   - Description: 200 pages per month included, $0.04 per page overage
   - Price 1: $19.00 USD / month, Recurring
   - Save, copy price ID as `STRIPE_PRICE_STARTER_MONTHLY`
   - Add another price to the same product: $190.00 USD / year, Recurring
   - Copy as `STRIPE_PRICE_STARTER_ANNUAL`
9. **Products → Add product** → Pro
   - Name: PRIZM Pro
   - Description: 1,000 pages per month included, $0.04 per page overage
   - Price 1: $49.00 USD / month, Recurring → `STRIPE_PRICE_PRO_MONTHLY`
   - Price 2: $490.00 USD / year, Recurring → `STRIPE_PRICE_PRO_ANNUAL`
10. **Products → Add product** → Overage
    - Name: PRIZM Overage Pages
    - Pricing model: Per unit
    - Price: $0.04 USD per unit, billed monthly via metered usage
    - This is for overage billing on Starter/Pro. Save price ID as `STRIPE_PRICE_OVERAGE_PAGE`.

### Part C. Customer Portal

11. **Settings → Billing → Customer portal**.
12. **Functionality**:
    - Customers can switch plans: ON (between Starter and Pro)
    - Customers can update quantities: OFF (we control quantities)
    - Cancel subscriptions: ON, **at period end** (no immediate refund flow in Phase 1)
    - Pause subscriptions: OFF
13. **Cancellation reason**: ON, optional textarea.
14. **Business info**: link to `https://prizmview.app/terms` and `https://prizmview.app/privacy`.
15. Save.

### Part D. Webhook endpoint

16. **Developers → Webhooks → Add endpoint**.
17. Endpoint URL: `https://prizmview.app/api/v1/webhooks/stripe` (use staging.prizmview.app for staging Stripe account, but you can also do one webhook with environment-aware routing).
18. **Events to listen to** (select these):
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `customer.subscription.trial_will_end`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
    - `customer.created`
    - `customer.deleted`
19. Add endpoint.
20. Click into the endpoint, **Reveal signing secret** (`whsec_...`). Copy as `STRIPE_WEBHOOK_SECRET`.

### Part E. API keys

21. **Developers → API keys**.
22. Copy `Publishable key` (`pk_test_...`) as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
23. Copy `Secret key` (`sk_test_...`) as `STRIPE_SECRET_KEY`. **Server-only, mark Sensitive in Vercel**.

### Part F. Once identity verifies, repeat in Live mode

After verification clears (you get an email):

24. Toggle to **Live mode**.
25. Repeat steps 7 through 23 in live mode. Live products and prices have different IDs than test. Save them as separate env vars in Vercel Production environment.

### Verify

Test-mode webhook locally:

```bash
# install Stripe CLI
brew install stripe/stripe-cli/stripe   # mac
# or download from stripe.com/docs/stripe-cli

stripe login
stripe listen --forward-to localhost:3030/api/v1/webhooks/stripe

# in another terminal
stripe trigger checkout.session.completed
```

You expect a 200 from your local webhook handler. (Wave 2 builds the handler. Wave 0 only confirms the wiring works once code lands.)

### Capture

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_OVERAGE_PAGE=price_...
```

(Plus a parallel set with `sk_live_`, `pk_live_`, etc. for production after verification.)

### Gotchas

- Live and test modes have separate webhook signing secrets. Mixing them up is a common Phase-1 bug.
- The Free tier as a $0 Stripe product gives you a customer record from signup, which makes upgrading one click. The alternative is "no Stripe customer until upgrade" which is also valid but adds complexity.
- Identity verification can stall on document quality. If it hangs more than 3 business days, contact Stripe support.
- Customer Portal cancellation "at period end" is the right default for accounting customers. Immediate cancel is a Phase-2 feature.

---

## 7. Resend (transactional email)

### What you are doing

Verifying the prizmview.app domain for email sending and capturing the API key.

### Pre-flight

- Domain registered (item 1).
- Access to your DNS provider (Cloudflare DNS, registrar, etc.) to add TXT records.
- Sign up at https://resend.com.

### Steps

1. https://resend.com/domains.
2. **Add Domain** → enter `prizmview.app`.
3. Region: `us-east-1`.
4. Resend shows DNS records to add. You will see:
   - 1 MX record (skip if your mailboxes are on a different provider like Google Workspace)
   - 3 to 4 TXT records: SPF (`v=spf1 ...`), DKIM (`resend._domainkey.prizmview.app`), and a verification record
5. Open your DNS provider in another tab.
6. Add each record exactly as shown. The DKIM TXT value is long; ensure the entire value lands in the record without truncation.
7. Save the records.
8. Back in Resend, click **Verify DNS Records**. First check might fail; DNS propagation takes 1 to 5 minutes. Retry until green.
9. Once verified, **API Keys** → **Create API Key**.
   - Name: `PRIZM Production`
   - Permission: **Full access** for now (we'll scope to "Sending only" in Phase 2 if needed).
   - Domain: `prizmview.app`.
   - Copy the key (`re_...`).

### Add a DMARC record (manual)

10. After Resend is verified, manually add a DMARC TXT record at your DNS provider:
    - Name: `_dmarc.prizmview.app`
    - Value: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@prizmview.app; ruf=mailto:dmarc-reports@prizmview.app; fo=1; aspf=s; adkim=s`
    - Start with `p=quarantine` for the first 30 days. Move to `p=reject` once you confirm no false positives.

### Verify

```bash
dig +short TXT prizmview.app
dig +short TXT resend._domainkey.prizmview.app
dig +short TXT _dmarc.prizmview.app
```

All three should return values. Send a test email from the Resend dashboard to your personal inbox; in the headers, look for `dkim=pass`, `spf=pass`, `dmarc=pass`.

### Capture

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@prizmview.app
```

### Gotchas

- DKIM TXT values can exceed 255 chars. Some DNS providers split into multiple quoted strings; that is fine, the spec supports concatenation.
- DMARC `p=reject` too early causes legitimate mail to bounce. Stay at `quarantine` for the first month.
- If you use Google Workspace or Fastmail for receiving mail at prizmview.app, do **not** add the Resend MX record. Keep your mail-receiving MX records.

---

## 8. Sentry (error tracking)

### What you are doing

Creating a Sentry project for the Next.js app, capturing the DSN and an auth token for source-map uploads.

### Pre-flight

- Sign up at https://sentry.io.
- Plan: **Developer (free)** is fine for Phase 1. Upgrade to Team ($26/month) once you have real traffic.

### Steps

1. https://sentry.io/signup. Use email `engineering@prizmview.app` if available, otherwise your personal.
2. Organization: name `prizm`, slug `prizm`.
3. **Create Project**.
4. Platform: **Next.js**.
5. Project name: `prizm-web`.
6. Alert frequency: **On every new issue**.
7. Sentry shows setup instructions for `@sentry/nextjs`. We already have it installed; skip the wizard.
8. **Settings → Projects → prizm-web → Client Keys (DSN)**. Copy the DSN.
9. **Settings → Account → Auth Tokens** (your personal account token).
   - **Create New Token** with scopes: `project:releases`, `project:read`, `project:write`, `org:read`. Name: `prizm-source-maps`.
   - Copy as `SENTRY_AUTH_TOKEN`.
10. **Settings → Projects → prizm-web → Filters & Data Scrubbing**:
    - Data scrubbing: **On**, default rules.
    - Add additional fields to scrub: `password`, `token`, `apiKey`, `secret`, `authorization`, `cookie`, `set-cookie`.
11. **Settings → Projects → prizm-web → Performance**: enable transactions. Sample rate: 0.1 in production (10%), 1.0 in dev.
12. **Settings → Projects → prizm-web → Spike Protection**: enable, set monthly cap (e.g. 50K events for Phase 1).

### Verify

After Wave 1 wires `@sentry/nextjs` properly:

```typescript
// throw a test error from a page
throw new Error('Sentry test event')
```

It should appear in the Sentry dashboard within 30 seconds.

### Capture

```
NEXT_PUBLIC_SENTRY_DSN=https://abc@o123.ingest.us.sentry.io/4567
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=prizm
SENTRY_PROJECT=prizm-web
```

### Gotchas

- Free tier caps at 5K events per month. Spike Protection prevents bill shock if a runaway loop logs millions of errors.
- Set Performance sample rate **low** in production (0.1 = 10%). 1.0 burns the event quota fast.
- PII scrubbing default-on but verify in your first deploy that headers and cookies are scrubbed in real events.

---

## 9. Upstash Redis (rate limit + idempotency)

### What you are doing

Creating a Redis database for token-bucket rate limiting and Stripe webhook idempotency.

### Pre-flight

- Sign up at https://upstash.com.
- Free tier (10K commands/day) is enough for Phase 1 dev. Pay-as-you-go is fine for prod.

### Steps

1. https://console.upstash.com/.
2. **Create Database** → **Redis**.
3. Name: `prizm-prod`.
4. Type:
   - **Regional** (recommended for Phase 1), single region, lower cost.
   - Global, multi-region, use only if Vercel functions deploy globally.
5. Region: `us-east-1` (matching Vercel default).
6. **TLS**: ON.
7. **Eviction**: NoEviction (fail-closed; don't quietly drop rate-limit state under memory pressure).
8. Click Create.
9. Open database → **Details** → **REST API** tab.
10. Copy:
    - REST URL (`https://us1-...-12345.upstash.io`)
    - REST Token (long opaque string)
11. (Recommended) Create a second database `prizm-staging` for staging Vercel.
12. **Settings → Alerts**: configure alerts on:
    - Memory > 80%
    - Daily commands > 80% of limit
    - Bandwidth > 80% of limit

### Verify

```bash
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/ping"
```

Returns `{"result":"PONG"}`.

```bash
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/set/test/hello"
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/get/test"
```

Round trip works.

### Capture

```
UPSTASH_REDIS_REST_URL=https://us1-...-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AYY...
```

### Gotchas

- Regional vs Global: Global has eventual consistency between regions. For rate limiting + idempotency, you want strong consistency, so Regional is the right pick unless Vercel functions deploy in Asia or EU regions where latency to us-east-1 hurts.
- The free tier counts every command against the daily limit. Rate-limit checks fire on every request. Watch consumption in dev and budget pay-as-you-go for prod.
- Don't store sensitive data in Redis. Rate-limit counters and idempotency keys only.

---

## Master env-var sheet

After completing all eight items, your scratch file should have these. Paste into Vercel → Project → Settings → Environment Variables, partitioned by environment.

```
# Public site
NEXT_PUBLIC_SITE_URL=https://prizmview.app                                     # production
NEXT_PUBLIC_SITE_URL=https://staging.prizmview.app                             # preview

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<prod-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...                                          # sensitive

# AWS (no static keys; OIDC role assumption at runtime)
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::<account>:role/vercel-prizm-prod-role
S3_UPLOAD_BUCKET=prizm-uploads-prod
S3_KMS_KEY_ID=arn:aws:kms:us-east-1:<account>:key/<uuid>

# Stripe
STRIPE_SECRET_KEY=sk_live_...                                              # sensitive
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...                                            # sensitive
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_OVERAGE_PAGE=price_...

# Resend
RESEND_API_KEY=re_...                                                      # sensitive
RESEND_FROM_EMAIL=noreply@prizmview.app

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...@o....ingest.us.sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...                                               # sensitive
SENTRY_ORG=prizm
SENTRY_PROJECT=prizm-web

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://us1-....upstash.io
UPSTASH_REDIS_REST_TOKEN=AYY...                                            # sensitive

# Cron auth (set this when Wave 2 builds the cron endpoints)
CRON_SECRET=<generate with: openssl rand -hex 32>                          # sensitive
```

GitHub repo secrets (separate from Vercel env vars):

```
VERCEL_TOKEN=...                  # Vercel Account Settings → Tokens
VERCEL_ORG_ID=team_...            # Vercel Project Settings → General
VERCEL_PROJECT_ID=prj_...         # Vercel Project Settings → General
SENTRY_AUTH_TOKEN=sntrys_...      # same as above; needed by CI for source maps
SENTRY_ORG=prizm
SENTRY_PROJECT=prizm-web
```

## Final checklist before pinging me

- [ ] Domain `prizmview.app` registered, DNSSEC + lock + 2FA on
- [ ] Supabase prod + staging projects up, env vars captured
- [ ] Vercel project deployed, custom domain attached, env vars set across all environments
- [ ] AWS Organization with prizm-prod + prizm-staging, S3 + KMS + Textract + Vercel-OIDC role configured per env
- [ ] Stripe identity verification submitted (live mode pending), test-mode products + prices + webhook + portal configured
- [ ] Resend domain verified, DKIM + SPF + DMARC records live
- [ ] Sentry project created, DSN + auth token captured, PII scrubbing on
- [ ] Upstash Redis prod + staging, REST URL + token captured
- [ ] All env vars pasted into Vercel, partitioned by environment, sensitive ones marked

When all eight are checked, I will:

1. Apply Supabase migration `0001_initial_schema.sql` via `supabase db push` once you `supabase link` the prod project locally
2. Smoke-test the Stripe webhook signature flow using `stripe trigger`
3. Confirm the AWS OIDC round-trip with a temporary `/api/health` route
4. Tag commit `v0.1.0-wave-0`
5. Dispatch Wave 1 (A1 Software Architect, A2 UX Architect, A3 Compliance Auditor in parallel)
