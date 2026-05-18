# PRIZM Next Session Handoff

Created: 2026-05-14
Updated: 2026-05-14

Use this file first in a new Codex session. The important product decision is settled:
PRIZM launch extraction uses Cloudflare R2 plus the Cloudflare Worker/Container Kotlin/JVM extractor, not AWS Textract.

## Copy-Paste Prompt

```text
Project PRIZM. Continue from:
C:\Users\hwa1a\Documents\Codex\2026-05-13\refresh-against-current-main-and-recent-5\prizm

Use TDD/diagnose discipline. Preserve the launch architecture:
DOCUMENT_STORAGE_PROVIDER=r2
DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2
Cloudflare Worker + Cloudflare Containers run the developed Kotlin/JVM extractor.

Do not treat AWS Textract as the launch path. AWS/S3/Textract is legacy compatibility only unless the user explicitly reopens that decision.

First read docs/runbooks/next-session-handoff.md. Then verify:
1. git status and current branch
2. GitHub PR/check status if a PR is open
3. production launch gate state through Vercel env
4. service-readiness archive result and remaining dashboard-only blockers
5. Cloudflare Worker/R2/Queue/container proof before claiming launch readiness
```

## Current Repo State

- Local repo: `C:\Users\hwa1a\Documents\Codex\2026-05-13\refresh-against-current-main-and-recent-5\prizm`
- GitHub repo: `https://github.com/hwa1alb1-bit/prizm`
- Base commit: `ced1524ad033b434b3ed100bcb9a4a440258fac7`
- Working branch during this handoff: `fix/cloudflare-production-launch-readiness`
- Current production deployment before this branch is merged:
  - `prizm-9o1q0gpp7-plknokos-projects.vercel.app`
  - commit `ced1524ad033b434b3ed100bcb9a4a440258fac7`
  - custom domains `prizmview.app` and `www.prizmview.app` point to that deployment.

## What This Branch Changes

### Launch Gates

- Production can no longer pass unless:
  - `DOCUMENT_STORAGE_PROVIDER=r2`
  - `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2`
- Production no longer requires legacy AWS/S3 launch variables when the Cloudflare R2 path is selected.
- Staging still supports the legacy AWS/S3 gate unless staging explicitly selects the Cloudflare R2 path.
- Production requires the full Cloudflare launch bundle before passing:
  - `R2_ACCOUNT_ID`
  - `R2_UPLOAD_BUCKET`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `CLOUDFLARE_EXTRACTOR_URL`
  - `CLOUDFLARE_EXTRACTOR_TOKEN`
  - `CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY`
  - `CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID`
  - `CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT`
  - `CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA`

### Service Readiness

- Service readiness now has a first-class `cloudflareR2Extractor` provider.
- It collects Cloudflare extractor health from:
  - `GET ${CLOUDFLARE_EXTRACTOR_URL}/v1/health`
  - `Authorization: Bearer ${CLOUDFLARE_EXTRACTOR_TOKEN}`
- Required Cloudflare checks:
  - job state bucket ok
  - upload bucket ok
  - extraction queue ok
  - Kotlin container ok
  - upload bucket healthcheck key matches `CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY`
  - staging proof id/date/sha are archived
- Local S3/Textract smoke is diagnostic under the Cloudflare launch path and does not satisfy or block launch readiness.
- `cloudflareR2Extractor` cannot be bypassed with accepted-gray proof.

### Release Invariant

- `pnpm verify:release` no longer trusts Vercel deployment aliases alone.
- It also inspects required custom hosts directly:
  - `prizmview.app`
  - `www.prizmview.app`
- Each host must point to the verified production deployment URL and be `READY`/`production`.

### Docs And Evidence

- `docs/runbooks/kotlin-worker-fallback.md` now treats Cloudflare R2/container extraction as the launch provider and Textract as legacy compatibility.
- `docs/runbooks/service-readiness-follow-up.md` now documents Cloudflare R2 extractor proof instead of AWS Textract subscription proof.
- Cloudflare extraction proof was archived under `docs/evidence/cloudflare-extraction/`.
- The latest extraction benchmark proof was generated under `docs/evidence/extraction-benchmarks/`.
- The latest service-readiness archive proves the Cloudflare extractor but still reports other launch-readiness gaps.

## Cloudflare State

Configured Worker:

- `prizm-cloudflare-extractor`

Configured resources in `workers/cloudflare-extractor/wrangler.jsonc`:

- Upload R2 bucket binding: `UPLOAD_BUCKET` -> `prizm-r2-uploads`
- Job state R2 bucket binding: `JOB_STATE_BUCKET` -> `prizm-extraction-jobs`
- Queue: `prizm-extractions`
- DLQ: `prizm-extractions-dlq`
- Container class: `KotlinExtractorContainer`
- Container image: `../kotlin-extractor/Dockerfile`
- Healthcheck storage key: `probes/known-good.pdf`

Archived Cloudflare proof:

- `docs/evidence/cloudflare-extraction/cf-extraction-staging-2026-05-14T21-14-43-312Z.json`
- Worker URL: `https://prizm-cloudflare-extractor.hwa1alb1-prizm.workers.dev`
- Proof SHA: `3678faa25bf3f2277f15d04b84975832c1ed6815bd9ac684a61b1917f2aae816`
- Health status: `ok`
- Extraction status: `succeeded`

## Verification Already Run

Focused tests:

```powershell
pnpm exec vitest run tests/unit/launch-gates.test.ts tests/unit/release-invariant.test.ts tests/unit/service-readiness.test.ts tests/unit/launch-operations.test.ts
# Passed: 4 files, 40 tests
```

Full local verify:

```powershell
pnpm verify
# Passed: format, lint, typecheck, 90 test files / 336 tests, Next build
```

Extraction gate with Java 21:

```powershell
$env:JAVA_HOME='C:\Users\hwa1a\Documents\Codex\2026-05-12\clon-main-prizm-from-github-locally\.tools\jdk-21.0.11+10'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
pnpm verify:extraction
# Exit code 0
```

Release invariant:

```powershell
pnpm verify:release
# ok: true
```

Production launch gate through Vercel env:

```powershell
$env:LAUNCH_GATE_TARGET='production'
npx vercel env run -e production --scope plknokos-projects -- pnpm check:launch-gates
# Launch gate passed for production
```

## Remaining Launch-Readiness Gaps

Do not claim PRIZM is fully launch-ready until service readiness is green. The latest archive still reports:

- authenticated `/api/ops/health` evidence has not been archived
- production provider evidence is still missing for Supabase, Stripe, Sentry, Resend, and Redis
- checkout-to-subscription-to-credit-grant proof has not been proven

Current important distinction:

- Cloudflare R2/container extractor proof is now present and healthy.
- AWS Textract subscription is not a launch blocker under the selected Cloudflare path.

## Useful Commands

Check launch gates:

```powershell
$env:LAUNCH_GATE_TARGET='production'
npx vercel env run -e production --scope plknokos-projects -- pnpm check:launch-gates
```

Archive service readiness:

```powershell
$env:OPS_HEALTH_COOKIE='<redacted owner/admin cookie>'
npx vercel env run -e production --scope plknokos-projects -- pnpm verify:service-readiness
```

Verify release invariant:

```powershell
pnpm verify:release
```

Verify extraction gate:

```powershell
$env:JAVA_HOME='C:\Users\hwa1a\Documents\Codex\2026-05-12\clon-main-prizm-from-github-locally\.tools\jdk-21.0.11+10'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
pnpm verify:extraction
```

## Publish/Merge Checklist

Before merging a PR from this branch:

1. Confirm the branch includes only the intended launch-readiness changes and evidence.
2. Confirm local verification remains green.
3. Push the branch and open a PR against `main`.
4. Wait for GitHub CI to pass.
5. Merge only after CI is green.
6. Pull updated `main`.
7. Re-run `pnpm verify:release` after merge if production deployment or alias state changed.
