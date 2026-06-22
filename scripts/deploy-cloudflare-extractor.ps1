<#
.SYNOPSIS
  Deploy the Cloudflare extractor (Worker + Kotlin container) and verify it against the
  ADR-009 benchmark gate.

.DESCRIPTION
  Pre-checks the repo state, deploys via wrangler from the current working tree, captures
  the new and previous Worker version IDs, waits for warmup, then runs the benchmark with
  a live target URL. On benchmark failure, prints the rollback command. On success, prints
  the evidence file path and the next git steps.

  Prerequisites:
    - Wrangler OAuth configured (via wrangler login). Memory note: PRIZM's wrangler OAuth
      lives under the HAlberts-SA profile at C:\Users\HAlberts-SA\AppData\Roaming\xdg.config\.wrangler\.
    - Vercel CLI access (npx vercel) to pull CLOUDFLARE_EXTRACTOR_TOKEN from prod env.
    - Local Docker daemon running (wrangler builds the container image locally).

.PARAMETER SkipBranchCheck
  Skip the "branch must be main" guard. Use only when deploying a hotfix from another branch
  on purpose.

.PARAMETER SkipDirtyCheck
  Skip the "working tree must be clean" guard. Useful when iterating locally before merge.

.PARAMETER SkipBenchmark
  Deploy the container but do not run the benchmark afterwards. Use only when the benchmark
  has already been validated separately, or when the goal is to roll forward without
  re-verifying contracts.

.EXAMPLE
  ./scripts/deploy-cloudflare-extractor.ps1
  Standard deploy + benchmark cycle from main.

.EXAMPLE
  ./scripts/deploy-cloudflare-extractor.ps1 -SkipBranchCheck -SkipDirtyCheck
  Deploy from a feature branch with uncommitted changes (for local iteration).
#>

[CmdletBinding()]
param(
  [switch]$SkipBranchCheck,
  [switch]$SkipDirtyCheck,
  [switch]$SkipBenchmark
)

$ErrorActionPreference = 'Stop'

$workerUrl = 'https://prizm-cloudflare-extractor.hwa1alb1-prizm.workers.dev'
$wranglerConfig = 'workers/cloudflare-extractor/wrangler.jsonc'
$pnpm = "$env:USERPROFILE\AppData\Roaming\npm\pnpm.cmd"
if (-not (Test-Path $pnpm)) {
  # Fallback: the helper is often run as HAlberts-SA against a HAlberts pnpm install.
  $pnpm = 'C:\Users\HAlberts\AppData\Roaming\npm\pnpm.cmd'
}

function Write-Section {
  param([string]$Title)
  Write-Host ''
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Block
  )
  Write-Host "[step] $Name" -ForegroundColor Gray
  & $Block
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

# --- Pre-checks ---

Write-Section 'Pre-checks'

$repoRoot = (& git rev-parse --show-toplevel) 2>$null
if (-not $repoRoot) { throw 'Not inside a git repository. cd into the prizm working tree first.' }
Set-Location $repoRoot
Write-Host "[ok] repo root: $repoRoot"

$branch = & git rev-parse --abbrev-ref HEAD
if (-not $SkipBranchCheck -and $branch -ne 'main') {
  throw "Branch is '$branch', expected 'main'. Switch to main or pass -SkipBranchCheck."
}
Write-Host "[ok] branch: $branch"

if (-not $SkipDirtyCheck) {
  $dirty = (& git status --porcelain) -join "`n"
  if ($dirty) {
    Write-Host $dirty
    throw 'Working tree is not clean. Commit, stash, or pass -SkipDirtyCheck.'
  }
}
Write-Host '[ok] working tree clean (or check skipped)'

Invoke-Step 'wrangler whoami' { & $pnpm exec wrangler whoami }

# Capture the currently-deployed Worker version so we can print the rollback command later.
$previousVersionLine = (& $pnpm exec wrangler deployments list --name prizm-cloudflare-extractor 2>$null `
  | Select-String -Pattern 'Version\(s\)' -Context 0, 2 `
  | Select-Object -First 1)
$previousVersionHint = if ($previousVersionLine) { $previousVersionLine.Context.PostContext -join ' ' } else { '(unable to read previous version; rollback via wrangler dashboard)' }
Write-Host "[ok] previous deployment hint: $previousVersionHint"

# --- Deploy ---

Write-Section 'Deploy'

Invoke-Step "wrangler deploy --config $wranglerConfig" {
  & $pnpm exec wrangler deploy --config $wranglerConfig
}

Write-Host '[ok] container + Worker deployed. Waiting 15 s for warmup...'
Start-Sleep -Seconds 15

# --- Benchmark ---

if ($SkipBenchmark) {
  Write-Section 'Benchmark (skipped)'
  Write-Host "[skipped] Benchmark not run. Validate live behaviour manually before announcing the deploy."
  Write-Host "[done] Worker URL: $workerUrl"
  return
}

Write-Section 'Benchmark'

if (-not (Test-Path '.env.production.local')) {
  Write-Host '[step] Vercel env pull (production)' -ForegroundColor Gray
  & npx vercel@latest env pull --environment=production .env.production.local
  if ($LASTEXITCODE -ne 0) { throw "vercel env pull failed with exit code $LASTEXITCODE" }
}

$extractorToken = (
  Get-Content .env.production.local
    | Where-Object { $_ -match '^CLOUDFLARE_EXTRACTOR_TOKEN=' }
    | ForEach-Object { ($_ -split '=', 2)[1].Trim('"') }
)
if (-not $extractorToken) {
  throw 'CLOUDFLARE_EXTRACTOR_TOKEN missing from .env.production.local. Re-run: npx vercel@latest env pull --environment=production .env.production.local'
}

$env:CLOUDFLARE_EXTRACTOR_TOKEN = $extractorToken
$env:BENCHMARK_EXTRACTION_TARGET_URL = $workerUrl
Write-Host "[ok] BENCHMARK_EXTRACTION_TARGET_URL = $workerUrl"

try {
  Invoke-Step 'pnpm benchmark:extraction' { & $pnpm benchmark:extraction }
} catch {
  Write-Host ''
  Write-Host '!!! Benchmark FAILED. Rollback the container before announcing the deploy:' -ForegroundColor Red
  Write-Host "    & '$pnpm' exec wrangler rollback --config $wranglerConfig" -ForegroundColor Red
  Write-Host ''
  Write-Host "Previous deployment hint:" -ForegroundColor Yellow
  Write-Host "    $previousVersionHint" -ForegroundColor Yellow
  throw
}

# --- Post-deploy steps ---

Write-Section 'Done'

Write-Host '[ok] Container deployed and benchmark gate passed.'
Write-Host ''
Write-Host 'Next steps:'
Write-Host '  1. Inspect docs/evidence/extraction-benchmarks/ for the latest JSON.'
Write-Host '  2. Commit + push the evidence file:'
Write-Host "        git add docs/evidence/extraction-benchmarks/"
Write-Host "        git commit -m 'chore(evidence): live-target benchmark after deploy'"
Write-Host "        git push"
Write-Host "  3. Smoke a real upload against $workerUrl (single-PDF and batch paths)."
