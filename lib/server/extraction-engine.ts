import 'server-only'

import { GetDocumentAnalysisCommand, StartDocumentAnalysisCommand } from '@aws-sdk/client-textract'
import {
  parseTextractStatement,
  type ParsedStatement,
  type ParsedStatementTransaction,
  type TextractOutput,
} from './statement-parser'
import { getTextractClient } from './textract'

export const DEFAULT_EXTRACTION_ENGINE = 'textract'
export const KOTLIN_WORKER_EXTRACTION_ENGINE = 'kotlin_worker'
export const CLOUDFLARE_R2_EXTRACTION_ENGINE = 'cloudflare-r2'

export type ExtractionStartInput = {
  documentId: string
  s3Bucket: string
  s3Key: string
  storageProvider?: 's3' | 'r2'
  storageBucket?: string
  storageKey?: string
}

export type ExtractionStartResult = {
  engine: string
  jobId: string
}

export type ExtractionPollInput = {
  jobId: string
}

export type ExtractionPollResult =
  | {
      status: 'in_progress'
      engine: string
      jobId: string
    }
  | {
      status: 'failed'
      engine: string
      jobId: string
      failureReason: string
    }
  | {
      status: 'succeeded'
      engine: string
      jobId: string
      statements: ParsedStatement[]
    }

export type ExtractionEngine = {
  name: string
  start: (input: ExtractionStartInput) => Promise<ExtractionStartResult>
  poll: (input: ExtractionPollInput) => Promise<ExtractionPollResult>
}

export type KotlinWorkerClient = {
  start: (input: ExtractionStartInput) => Promise<{ jobId: string }>
  poll: (input: ExtractionPollInput) => Promise<unknown>
}

export type ExtractionEngineEnv = {
  NODE_ENV?: string
  VERCEL_ENV?: string
  DOCUMENT_EXTRACTION_PROVIDER?: string
  PRIZM_EXTRACTION_ENGINE?: string
  CLOUDFLARE_EXTRACTOR_URL?: string
  CLOUDFLARE_EXTRACTOR_TOKEN?: string
  KOTLIN_WORKER_URL?: string
  KOTLIN_WORKER_API_KEY?: string
}

export type CreateDefaultExtractionEngineInput = {
  env?: ExtractionEngineEnv
  kotlinWorker?: KotlinWorkerClient
}

export type CreateExtractionEngineByNameInput = {
  kotlinWorker?: KotlinWorkerClient
}

export function createDefaultExtractionEngine(
  input: CreateDefaultExtractionEngineInput = {},
): ExtractionEngine {
  if (resolveDefaultExtractionEngineName(input.env) === KOTLIN_WORKER_EXTRACTION_ENGINE) {
    return createKotlinWorkerExtractionEngine({
      worker: input.kotlinWorker ?? createHttpKotlinWorkerClient(input.env),
    })
  }
  if (resolveDefaultExtractionEngineName(input.env) === CLOUDFLARE_R2_EXTRACTION_ENGINE) {
    return createCloudflareR2ExtractionEngine({
      worker: input.kotlinWorker ?? createHttpKotlinWorkerClient(input.env),
    })
  }

  return createTextractExtractionEngine()
}

export function resolveDefaultExtractionEngineName(
  env: ExtractionEngineEnv = process.env,
):
  | typeof DEFAULT_EXTRACTION_ENGINE
  | typeof KOTLIN_WORKER_EXTRACTION_ENGINE
  | typeof CLOUDFLARE_R2_EXTRACTION_ENGINE {
  if (env.DOCUMENT_EXTRACTION_PROVIDER === CLOUDFLARE_R2_EXTRACTION_ENGINE) {
    return CLOUDFLARE_R2_EXTRACTION_ENGINE
  }

  if (
    env.PRIZM_EXTRACTION_ENGINE === KOTLIN_WORKER_EXTRACTION_ENGINE &&
    !isProductionExtractionTarget(env)
  ) {
    return KOTLIN_WORKER_EXTRACTION_ENGINE
  }

  return DEFAULT_EXTRACTION_ENGINE
}

function isProductionExtractionTarget(env: ExtractionEngineEnv): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production'
  return env.NODE_ENV === 'production'
}

export function createExtractionEngineByName(
  name: string,
  input: CreateExtractionEngineByNameInput = {},
): ExtractionEngine | null {
  if (name === DEFAULT_EXTRACTION_ENGINE) return createTextractExtractionEngine()
  if (name === CLOUDFLARE_R2_EXTRACTION_ENGINE) {
    return createCloudflareR2ExtractionEngine({ worker: input.kotlinWorker })
  }
  if (name === KOTLIN_WORKER_EXTRACTION_ENGINE) {
    return createKotlinWorkerExtractionEngine({ worker: input.kotlinWorker })
  }
  return null
}

export function createTextractExtractionEngine(): ExtractionEngine {
  return {
    name: DEFAULT_EXTRACTION_ENGINE,
    start: startTextractExtraction,
    poll: pollTextractExtraction,
  }
}

export function createKotlinWorkerExtractionEngine(
  input: { worker?: KotlinWorkerClient } = {},
): ExtractionEngine {
  return createWorkerExtractionEngine(KOTLIN_WORKER_EXTRACTION_ENGINE, input)
}

export function createCloudflareR2ExtractionEngine(
  input: { worker?: KotlinWorkerClient } = {},
): ExtractionEngine {
  return createWorkerExtractionEngine(CLOUDFLARE_R2_EXTRACTION_ENGINE, input)
}

function createWorkerExtractionEngine(
  engineName: typeof KOTLIN_WORKER_EXTRACTION_ENGINE | typeof CLOUDFLARE_R2_EXTRACTION_ENGINE,
  input: { worker?: KotlinWorkerClient } = {},
): ExtractionEngine {
  const worker = input.worker ?? createHttpKotlinWorkerClient()

  return {
    name: engineName,
    start: async (startInput) => {
      const result = await worker.start(startInput)
      return {
        engine: engineName,
        jobId: result.jobId,
      }
    },
    poll: async (pollInput) => {
      const result = await worker.poll(pollInput)
      return normalizeKotlinWorkerPollResult(pollInput, result, engineName)
    },
  }
}

async function startTextractExtraction(
  input: ExtractionStartInput,
): Promise<ExtractionStartResult> {
  const result = await getTextractClient().send(
    new StartDocumentAnalysisCommand({
      ClientRequestToken: textractClientToken(input.documentId),
      DocumentLocation: {
        S3Object: {
          Bucket: input.s3Bucket,
          Name: input.s3Key,
        },
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    }),
  )

  if (!result.JobId) throw new Error('textract_job_id_missing')
  return {
    engine: DEFAULT_EXTRACTION_ENGINE,
    jobId: result.JobId,
  }
}

async function pollTextractExtraction(input: ExtractionPollInput): Promise<ExtractionPollResult> {
  const output = await getTextractAnalysis(input)

  if (output.JobStatus === 'IN_PROGRESS') {
    return {
      status: 'in_progress',
      engine: DEFAULT_EXTRACTION_ENGINE,
      jobId: input.jobId,
    }
  }

  if (output.JobStatus !== 'SUCCEEDED') {
    return {
      status: 'failed',
      engine: DEFAULT_EXTRACTION_ENGINE,
      jobId: input.jobId,
      failureReason: `Textract analysis finished with status ${output.JobStatus ?? 'UNKNOWN'}.`,
    }
  }

  const parsed = parseTextractStatement(output)
  return {
    status: 'succeeded',
    engine: DEFAULT_EXTRACTION_ENGINE,
    jobId: input.jobId,
    statements: parsed.statements,
  }
}

async function getTextractAnalysis(input: { jobId: string }): Promise<TextractOutput> {
  const blocks: NonNullable<TextractOutput['Blocks']> = []
  let nextToken: string | undefined
  let jobStatus: TextractOutput['JobStatus']

  do {
    const result = await getTextractClient().send(
      new GetDocumentAnalysisCommand({
        JobId: input.jobId,
        NextToken: nextToken,
      }),
    )
    jobStatus = result.JobStatus
    blocks.push(...(result.Blocks ?? []))
    nextToken = result.NextToken
  } while (nextToken)

  return {
    JobStatus: jobStatus,
    Blocks: blocks.map((block) => ({
      BlockType: block.BlockType,
      Text: block.Text,
      Confidence: block.Confidence,
    })),
  }
}

function textractClientToken(documentId: string): string {
  return documentId.replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 64)
}

function createHttpKotlinWorkerClient(
  env: ExtractionEngineEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): KotlinWorkerClient {
  return {
    start: async (input) => {
      const output = await requestKotlinWorker(env, fetchImpl, '/v1/extractions', {
        method: 'POST',
        body: JSON.stringify(input),
      })

      if (!isRecord(output) || typeof output.jobId !== 'string') {
        throw new Error('kotlin_worker_job_id_missing')
      }

      return { jobId: output.jobId }
    },
    poll: async (input) =>
      requestKotlinWorker(env, fetchImpl, `/v1/extractions/${encodeURIComponent(input.jobId)}`, {
        method: 'GET',
      }),
  }
}

async function requestKotlinWorker(
  env: ExtractionEngineEnv,
  fetchImpl: typeof fetch,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const workerUrl = env.CLOUDFLARE_EXTRACTOR_URL ?? env.KOTLIN_WORKER_URL
  const workerToken = env.CLOUDFLARE_EXTRACTOR_TOKEN ?? env.KOTLIN_WORKER_API_KEY
  if (!workerUrl) throw new Error('kotlin_worker_url_missing')

  const response = await fetchImpl(new URL(path, withTrailingSlash(workerUrl)), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(workerToken ? { authorization: `Bearer ${workerToken}` } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) throw new Error(`kotlin_worker_http_${response.status}`)
  return response.json()
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function normalizeKotlinWorkerPollResult(
  input: ExtractionPollInput,
  output: unknown,
  engineName:
    | typeof KOTLIN_WORKER_EXTRACTION_ENGINE
    | typeof CLOUDFLARE_R2_EXTRACTION_ENGINE = KOTLIN_WORKER_EXTRACTION_ENGINE,
): ExtractionPollResult {
  if (!isRecord(output)) return invalidKotlinWorkerOutput(input, engineName)

  if (output.status === 'in_progress') {
    return {
      status: 'in_progress',
      engine: engineName,
      jobId: input.jobId,
    }
  }

  if (output.status === 'failed') {
    return {
      status: 'failed',
      engine: engineName,
      jobId: input.jobId,
      failureReason:
        typeof output.failureReason === 'string'
          ? output.failureReason
          : 'Kotlin worker extraction failed.',
    }
  }

  if (output.status !== 'succeeded' || !Array.isArray(output.statements)) {
    return invalidKotlinWorkerOutput(input, engineName)
  }

  const statements = output.statements.map((statement) => normalizeParsedStatement(statement))
  if (statements.some((statement) => statement === null)) {
    return invalidKotlinWorkerOutput(input, engineName)
  }

  return {
    status: 'succeeded',
    engine: engineName,
    jobId: typeof output.jobId === 'string' ? output.jobId : input.jobId,
    statements: statements.filter(isParsedStatement),
  }
}

function invalidKotlinWorkerOutput(
  input: ExtractionPollInput,
  engineName:
    | typeof KOTLIN_WORKER_EXTRACTION_ENGINE
    | typeof CLOUDFLARE_R2_EXTRACTION_ENGINE = KOTLIN_WORKER_EXTRACTION_ENGINE,
): ExtractionPollResult {
  return {
    status: 'failed',
    engine: engineName,
    jobId: input.jobId,
    failureReason: 'Kotlin worker returned invalid normalized statement data.',
  }
}

function normalizeParsedStatement(input: unknown): ParsedStatement | null {
  if (!isRecord(input)) return null
  if (input.statementType !== 'bank' && input.statementType !== 'credit_card') return null
  if (!isNullableString(input.bankName)) return null
  if (!isNullableString(input.accountLast4)) return null
  if (!isNullableString(input.periodStart)) return null
  if (!isNullableString(input.periodEnd)) return null
  if (!isNullableNumber(input.openingBalance)) return null
  if (!isNullableNumber(input.closingBalance)) return null
  if (!isNullableNumber(input.reportedTotal)) return null
  if (!isFiniteNumber(input.computedTotal)) return null
  if (typeof input.reconciles !== 'boolean') return null
  if (typeof input.ready !== 'boolean') return null
  if (!isConfidence(input.confidence)) return null
  if (!isStringArray(input.reviewFlags)) return null
  if (!isMetadata(input.metadata)) return null
  if (!Array.isArray(input.transactions)) return null

  const transactions = input.transactions.map((transaction) => normalizeTransaction(transaction))
  if (transactions.some((transaction) => transaction === null)) return null

  return {
    statementType: input.statementType,
    bankName: input.bankName,
    accountLast4: input.accountLast4,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    openingBalance: input.openingBalance,
    closingBalance: input.closingBalance,
    reportedTotal: input.reportedTotal,
    computedTotal: input.computedTotal,
    reconciles: input.reconciles,
    ready: input.ready,
    confidence: input.confidence,
    reviewFlags: input.reviewFlags,
    metadata: input.metadata,
    transactions: transactions.filter(isParsedStatementTransaction),
  }
}

function normalizeTransaction(input: unknown): ParsedStatementTransaction | null {
  if (!isRecord(input)) return null
  if (typeof input.date !== 'string') return null
  if (typeof input.description !== 'string') return null
  if (!isFiniteNumber(input.amount)) return null
  if (!isFiniteNumber(input.confidence)) return null

  const transaction: ParsedStatementTransaction & Record<string, unknown> = {
    date: input.date,
    description: input.description,
    amount: input.amount,
    confidence: input.confidence,
  }

  copyOptionalNumber(transaction, input, 'debit')
  copyOptionalNumber(transaction, input, 'credit')
  copyOptionalNumber(transaction, input, 'balance')
  copyOptionalString(transaction, input, 'source')
  copyOptionalString(transaction, input, 'transaction_date')
  copyOptionalString(transaction, input, 'merchant')
  copyOptionalString(transaction, input, 'category')
  copyOptionalString(transaction, input, 'statement_section')
  copyOptionalString(transaction, input, 'reference')
  copyOptionalBoolean(transaction, input, 'needs_review')
  copyOptionalString(transaction, input, 'review_reason')

  return transaction
}

function copyOptionalNumber(
  target: Record<string, unknown>,
  input: Record<string, unknown>,
  key: string,
): void {
  const value = input[key]
  if (typeof value === 'undefined') return
  if (isFiniteNumber(value)) target[key] = value
}

function copyOptionalString(
  target: Record<string, unknown>,
  input: Record<string, unknown>,
  key: string,
): void {
  const value = input[key]
  if (typeof value === 'undefined') return
  if (typeof value === 'string') target[key] = value
}

function copyOptionalBoolean(
  target: Record<string, unknown>,
  input: Record<string, unknown>,
  key: string,
): void {
  const value = input[key]
  if (typeof value === 'undefined') return
  if (typeof value === 'boolean') target[key] = value
}

function isConfidence(value: unknown): value is ParsedStatement['confidence'] {
  if (!isRecord(value)) return false
  return (
    isFiniteNumber(value.overall) &&
    isFiniteNumber(value.fields) &&
    isFiniteNumber(value.transactions)
  )
}

function isMetadata(value: unknown): value is ParsedStatement['metadata'] {
  if (!isRecord(value)) return false
  return Object.values(value).every(
    (entry) =>
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean',
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isParsedStatement(value: ParsedStatement | null): value is ParsedStatement {
  return value !== null
}

function isParsedStatementTransaction(
  value: ParsedStatementTransaction | null,
): value is ParsedStatementTransaction {
  return value !== null
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
