# Vercel Custom-Domain Alias Runbook

How `pdftoexcelstatementconverter.com` keeps following production deploys,
and how to recover if it does not.

## Why this exists

Vercel's GitHub integration ships a production deploy on every push to
`main` automatically — but on this project the **custom-domain aliases**
(`pdftoexcelstatementconverter.com` + `www`) do not auto-follow that
deploy. Without intervention the alias stays pinned to whatever build
was promoted last, the edge keeps serving that build's responses
(including `404` for routes that did not exist yet), and the path stays
broken until someone clicks **Promote to Production** in the dashboard.

This pattern previously caused PRs #84 (`/forgot-password` + `/reset`),
#88 + #89 (`/faq`), and #91 (`/auth/finish` + `/login`). Each was a
no-op cache-bust commit that "worked" only because the merge prompted a
manual promote.

## Permanent fix

The workflow `.github/workflows/promote-production.yml` runs after every
successful CI run on `main`. It:

1. Resolves the head SHA from the `workflow_run` event.
2. Polls `GET /v6/deployments?target=production&state=READY` for the
   Vercel deploy whose `meta.githubCommitSha` matches that SHA. Polls
   for up to 10 minutes (Vercel deploys usually land in 2–3 min).
3. POSTs `/v2/deployments/{id}/aliases` for both `pdftoexcelstatementconverter.com`
   and `www.pdftoexcelstatementconverter.com` so both follow the same
   deploy.
4. Hits the apex with a unique cache buster to confirm 200.

The workflow is also triggerable from the Actions tab with
`workflow_dispatch` and an optional `sha` input — use this to manually
re-promote a known-good commit if the alias drifts again.

## One-time setup

This workflow needs a repo secret called `VERCEL_TOKEN`.

1. Go to https://vercel.com/account/tokens
2. **Create Token**:
   - Name: `prizm github actions alias`
   - Scope: select the `plknokos-projects` team (not "Full Account").
   - Expiration: longest available (1 year recommended; the workflow
     will start failing visibly if it expires).
3. Copy the token (starts with `vercel_…`).
4. In GitHub: https://github.com/hwa1alb1-bit/prizm/settings/secrets/actions
   → **New repository secret**
   - Name: `VERCEL_TOKEN`
   - Value: paste the token.
5. Trigger a manual test run:
   - https://github.com/hwa1alb1-bit/prizm/actions/workflows/promote-production.yml
   - **Run workflow** → leave `sha` blank → **Run workflow**.
   - Should finish in ~30 seconds and report apex returning 200.

After this, every merge to `main` auto-promotes. No more manual Promote
clicks, no more `.vercel-cache-bust` PRs.

## Manual recovery (if the workflow is broken)

If the workflow fails or you need to promote a specific deploy without
CI:

1. Open https://vercel.com/plknokos-projects/prizm/deployments.
2. Find the **Production · Ready** deploy you want live.
3. Click the `⋯` menu → **Promote to Production**.
4. Wait ~10 seconds. Verify with:
   ```powershell
   curl.exe -sI "https://pdftoexcelstatementconverter.com/?cb=$([int64](Get-Date -UFormat %s))" `
     | Select-String "HTTP|Age"
   ```
   You want `HTTP/1.1 200 OK` and `Age: 0` (or low single-digit).

## Why not just configure the dashboard?

The Vercel dashboard does have a "Production Branch" setting per project
and a "Git Branch" setting per domain. If both are set to `main`, Vercel
should in theory auto-promote — but this repo has been live with that
setup and the alias still drifts. The CI-driven approach is bulletproof
regardless of dashboard config, and the diff is auditable in git rather
than living invisibly in a vendor UI.

## Related artifacts

- Workflow: `.github/workflows/promote-production.yml`
- Vercel project + team IDs: hard-coded as `env:` in the workflow (also
  in `.vercel/project.json` if you need to confirm).
- Historical incidents: PRs #84, #88, #89, #91 (all cache-busts that
  this workflow makes obsolete).
- The previous Cloudflare zone-file mirroring exercise:
  `docs/runbooks/auth-email.md`.
