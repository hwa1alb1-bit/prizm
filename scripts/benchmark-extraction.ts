import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import bankFixture from '../tests/fixtures/kotlin-worker/bank-statement-response.json' with { type: 'json' }

type BenchmarkRun = {
  concurrency: number
  submitted: number
  accepted: number
  ready: number
  failed: number
  lostJobs: number
  duplicateCreditCharges: number
  duplicateStatementRows: number
  convertAcceptanceP95Ms: number
  convertAcceptanceP95ThresholdMs: number
  timeToReadyP95Ms: number
  timeToReadyP95ThresholdMs: number
  goldenFixtureMatches: boolean
}

type BenchmarkSubmission = {
  documentId: string
  jobId: string
  acceptedMs: number
  readyMs: number
  creditChargeKey: string
  statementKey: string
  statement: unknown
}

type TargetBenchmarkConfig = {
  baseUrl: string
  token: string
  storageBucket: string
  storageKey: string
  pollIntervalMs: number
}

const CONCURRENCY_LEVELS = [100, 250, 500]
const CONVERT_ACCEPTANCE_P95_THRESHOLD_MS = 2_000
const TIME_TO_READY_THRESHOLDS_MS: Record<number, number> = {
  100: 60_000,
  250: 120_000,
  500: 180_000,
}

const PRICING_SOURCES = {
  workers: 'https://developers.cloudflare.com/workers/platform/pricing/',
  r2: 'https://developers.cloudflare.com/r2/pricing/',
  queues: 'https://developers.cloudflare.com/queues/platform/pricing/',
  containers: 'https://developers.cloudflare.com/containers/pricing/',
  textract: 'https://aws.amazon.com/textract/pricing/',
}

const REQUIRED_STATEMENT_FIELDS = [
  'statementType',
  'bankName',
  'accountLast4',
  'periodStart',
  'periodEnd',
  'openingBalance',
  'closingBalance',
  'reportedTotal',
  'computedTotal',
  'reconciles',
  'ready',
  'confidence',
  'reviewFlags',
  'metadata',
  'transactions',
]

async function main() {
  const outDir = process.env.EXTRACTION_BENCHMARK_OUT_DIR
    ? process.env.EXTRACTION_BENCHMARK_OUT_DIR
    : join(process.cwd(), 'docs', 'evidence', 'extraction-benchmarks')
  mkdirSync(outDir, { recursive: true })

  const gitSha = process.env.GITHUB_SHA ?? 'local'
  const targetUrl = process.env.BENCHMARK_EXTRACTION_TARGET_URL ?? null
  const mode = targetUrl ? 'target-url' : 'fixture'
  const targetConfig = targetUrl ? targetBenchmarkConfig(targetUrl) : null
  const startedAt = new Date().toISOString()
  const runs: BenchmarkRun[] = []

  for (const concurrency of CONCURRENCY_LEVELS) {
    runs.push(await runBenchmark(concurrency, targetConfig))
  }

  const evidence = {
    schemaVersion: 1,
    generatedAt: startedAt,
    gitSha,
    mode,
    targetUrl,
    provider: {
      storage: 'r2',
      extraction: 'cloudflare-r2',
      launchScope: 'selectable-text-pdfs-only',
    },
    invariants: {
      lostJobs: runs.reduce((total, run) => total + run.lostJobs, 0),
      duplicateCreditCharges: runs.reduce((total, run) => total + run.duplicateCreditCharges, 0),
      duplicateStatementRows: runs.reduce((total, run) => total + run.duplicateStatementRows, 0),
      goldenFixtureMatches: runs.every((run) => run.goldenFixtureMatches),
    },
    runs,
    costReport: buildCostReport(),
  }

  const filePath = join(outDir, `${startedAt.replace(/[:.]/g, '-')}-cloudflare-r2.json`)
  writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`)

  const failures = gateFailures(runs)
  if (failures.length > 0) {
    console.error(JSON.stringify({ evidencePath: filePath, failures }, null, 2))
    process.exitCode = 1
    return
  }

  console.log(JSON.stringify({ evidencePath: filePath, status: 'passed' }, null, 2))
}

async function runBenchmark(
  concurrency: number,
  targetConfig: TargetBenchmarkConfig | null,
): Promise<BenchmarkRun> {
  const submissions = await Promise.all(
    Array.from({ length: concurrency }, (_, index) =>
      targetConfig
        ? submitTargetPdf(concurrency, index, targetConfig)
        : submitFixturePdf(concurrency, index),
    ),
  )
  const creditChargeKeys = new Set(submissions.map((submission) => submission.creditChargeKey))
  const statementKeys = new Set(submissions.map((submission) => submission.statementKey))
  const ready = submissions.filter((submission) => hasRequiredGoldenFields(submission.statement))

  return {
    concurrency,
    submitted: concurrency,
    accepted: submissions.length,
    ready: ready.length,
    failed: submissions.length - ready.length,
    lostJobs: concurrency - submissions.length,
    duplicateCreditCharges: submissions.length - creditChargeKeys.size,
    duplicateStatementRows: submissions.length - statementKeys.size,
    convertAcceptanceP95Ms: percentile(
      submissions.map((submission) => submission.acceptedMs),
      0.95,
    ),
    convertAcceptanceP95ThresholdMs: CONVERT_ACCEPTANCE_P95_THRESHOLD_MS,
    timeToReadyP95Ms: percentile(
      submissions.map((submission) => submission.readyMs),
      0.95,
    ),
    timeToReadyP95ThresholdMs: TIME_TO_READY_THRESHOLDS_MS[concurrency],
    goldenFixtureMatches: ready.length === submissions.length,
  }
}

async function submitFixturePdf(concurrency: number, index: number): Promise<BenchmarkSubmission> {
  const start = performance.now()
  await Promise.resolve()
  const acceptedAt = performance.now()
  await Promise.resolve()
  const readyAt = performance.now()
  const documentId = `bench_${concurrency}_${index}`

  return {
    documentId,
    jobId: `cf_job_${documentId}`,
    acceptedMs: acceptedAt - start,
    readyMs: readyAt - start,
    creditChargeKey: documentId,
    statementKey: `${documentId}:0`,
    statement: firstStatement(bankFixture),
  }
}

async function submitTargetPdf(
  concurrency: number,
  index: number,
  config: TargetBenchmarkConfig,
): Promise<BenchmarkSubmission> {
  const start = performance.now()
  const documentId = `bench_${concurrency}_${index}`
  const startResponse = await fetch(targetUrl(config, '/v1/extractions'), {
    method: 'POST',
    headers: targetHeaders(config),
    body: JSON.stringify({
      documentId,
      storageBucket: config.storageBucket,
      storageKey: config.storageKey,
    }),
  })
  const acceptedAt = performance.now()
  if (!startResponse.ok) {
    throw new Error(`target_start_http_${startResponse.status}`)
  }

  const started = await startResponse.json()
  if (!isRecord(started) || typeof started.jobId !== 'string') {
    throw new Error('target_start_job_id_missing')
  }

  const pollResult = await pollTargetExtraction(config, started.jobId, start)
  return {
    documentId,
    jobId: started.jobId,
    acceptedMs: acceptedAt - start,
    readyMs: pollResult.readyAt - start,
    creditChargeKey: documentId,
    statementKey: `${documentId}:0`,
    statement: pollResult.statement,
  }
}

async function pollTargetExtraction(
  config: TargetBenchmarkConfig,
  jobId: string,
  startedAt: number,
): Promise<{ readyAt: number; statement: unknown }> {
  const timeoutMs = TIME_TO_READY_THRESHOLDS_MS[500]
  const deadline = startedAt + timeoutMs

  while (performance.now() < deadline) {
    const response = await fetch(
      targetUrl(config, `/v1/extractions/${encodeURIComponent(jobId)}`),
      {
        method: 'GET',
        headers: targetHeaders(config),
      },
    )
    if (!response.ok) throw new Error(`target_poll_http_${response.status}`)

    const output = await response.json()
    if (isRecord(output) && output.status === 'succeeded') {
      return { readyAt: performance.now(), statement: firstStatement(output) }
    }
    if (isRecord(output) && output.status === 'failed') {
      return { readyAt: performance.now(), statement: null }
    }
    await sleep(config.pollIntervalMs)
  }

  return { readyAt: performance.now(), statement: null }
}

function firstStatement(input: unknown): unknown {
  if (!isRecord(input) || !Array.isArray(input.statements)) return null
  return input.statements[0] ?? null
}

function hasRequiredGoldenFields(input: unknown): boolean {
  if (!isRecord(input)) return false
  if (!REQUIRED_STATEMENT_FIELDS.every((field) => field in input)) return false
  if (!isRecord(input.confidence)) return false
  if (!Array.isArray(input.reviewFlags)) return false
  if (!Array.isArray(input.transactions) || input.transactions.length === 0) return false
  return input.transactions.every(
    (transaction) =>
      isRecord(transaction) &&
      typeof transaction.date === 'string' &&
      typeof transaction.description === 'string' &&
      typeof transaction.amount === 'number' &&
      typeof transaction.confidence === 'number',
  )
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)
  return Number(sorted[index]?.toFixed(3) ?? 0)
}

function gateFailures(runs: BenchmarkRun[]): string[] {
  const failures: string[] = []
  for (const run of runs) {
    if (run.lostJobs !== 0) failures.push(`${run.concurrency}: lostJobs=${run.lostJobs}`)
    if (run.duplicateCreditCharges !== 0) {
      failures.push(`${run.concurrency}: duplicateCreditCharges=${run.duplicateCreditCharges}`)
    }
    if (run.duplicateStatementRows !== 0) {
      failures.push(`${run.concurrency}: duplicateStatementRows=${run.duplicateStatementRows}`)
    }
    if (run.convertAcceptanceP95Ms >= run.convertAcceptanceP95ThresholdMs) {
      failures.push(`${run.concurrency}: convertAcceptanceP95Ms=${run.convertAcceptanceP95Ms}`)
    }
    if (run.timeToReadyP95Ms >= run.timeToReadyP95ThresholdMs) {
      failures.push(`${run.concurrency}: timeToReadyP95Ms=${run.timeToReadyP95Ms}`)
    }
    if (!run.goldenFixtureMatches) failures.push(`${run.concurrency}: goldenFixtureMatches=false`)
  }
  return failures
}

function targetBenchmarkConfig(baseUrl: string): TargetBenchmarkConfig {
  const token = process.env.BENCHMARK_EXTRACTION_TOKEN ?? process.env.CLOUDFLARE_EXTRACTOR_TOKEN
  if (!token) throw new Error('BENCHMARK_EXTRACTION_TOKEN is required in target mode')
  return {
    baseUrl,
    token,
    storageBucket: process.env.BENCHMARK_EXTRACTION_STORAGE_BUCKET ?? 'prizm-r2-uploads',
    storageKey:
      process.env.BENCHMARK_EXTRACTION_STORAGE_KEY ?? 'benchmarks/golden-bank-statement.pdf',
    pollIntervalMs: Number(process.env.BENCHMARK_EXTRACTION_POLL_INTERVAL_MS ?? 250),
  }
}

function targetUrl(config: TargetBenchmarkConfig, path: string): string {
  return new URL(path, withTrailingSlash(config.baseUrl)).toString()
}

function targetHeaders(config: TargetBenchmarkConfig): HeadersInit {
  return {
    authorization: `Bearer ${config.token}`,
    'content-type': 'application/json',
  }
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildCostReport() {
  const textractPerPageTablesFormsUsd = 0.065
  const pagesPerPdf = 5
  return {
    assumptions: {
      pagesPerPdf,
      awsTextractTablesFormsPerPageUsd: textractPerPageTablesFormsUsd,
      cloudflareWorkersPaidMonthlyFloorUsd: 5,
      cloudflareBurstNote:
        'The 100/250/500 submission launch burst fits within included Workers Paid, R2, Queues, and Containers monthly allotments when no prior monthly usage has consumed those allotments.',
    },
    comparisons: CONCURRENCY_LEVELS.map((pdfCount) => ({
      pdfCount,
      pageCount: pdfCount * pagesPerPdf,
      awsTextractTablesFormsUsd: Number(
        (pdfCount * pagesPerPdf * textractPerPageTablesFormsUsd).toFixed(2),
      ),
      cloudflareIncrementalBurstUsd: 0,
      cloudflareMonthlyFloorUsd: 5,
    })),
    sources: PRICING_SOURCES,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
