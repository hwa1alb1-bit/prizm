export type WorkerPollResponse = {
  status: 'in_progress' | 'succeeded' | 'failed'
  jobId?: string
  statements?: unknown[]
  failureReason?: string
}

export type ExtractionJobMessage = {
  jobId: string
  documentId: string
  storageBucket: string
  storageKey: string
}

export type ExtractionStartRequest = {
  documentId: string
  storageBucket: string
  storageKey: string
}

export type CloudflareExtractorEnv = {
  EXTRACTOR_TOKEN: string
  UPLOAD_BUCKET_NAME: string
  HEALTHCHECK_STORAGE_KEY?: string
  UPLOAD_BUCKET: R2BucketLike
  JOB_STATE_BUCKET: R2BucketLike
  EXTRACTION_QUEUE: QueueLike<ExtractionJobMessage>
  KOTLIN_EXTRACTOR: ContainerNamespaceLike
}

export type R2BucketLike = {
  get: (key: string) => Promise<R2ObjectBodyLike | null>
  put: (
    key: string,
    value: string | ReadableStream | Blob,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>
}

export type R2ObjectBodyLike = {
  body?: ReadableStream | null
  text?: () => Promise<string>
}

export type QueueLike<T> = {
  send: (message: T) => Promise<unknown>
}

export type ContainerNamespaceLike = {
  getByName: (name: string) => ContainerStubLike
}

export type ContainerStubLike = {
  fetch: (request: Request) => Promise<Response>
}

export type QueueBatchLike<T> = {
  messages: Array<{
    body: T
    ack?: () => void
    retry?: (options?: { delaySeconds?: number }) => void
  }>
}

const JOB_PREFIX = 'jobs/'
const HEALTHCHECK_STATE_KEY = 'health/probe.json'

export async function handleCloudflareExtractorRequest(
  request: Request,
  env: CloudflareExtractorEnv,
): Promise<Response> {
  if (!(await isAuthorized(request, env))) {
    return jsonResponse(
      {
        status: 'failed',
        failureReason: 'Unauthorized.',
      },
      401,
    )
  }

  const url = new URL(request.url)

  if (url.pathname === '/v1/health') {
    if (request.method !== 'GET') return methodNotAllowed('GET')
    return healthCheck(env)
  }

  if (url.pathname === '/v1/extractions') {
    if (request.method !== 'POST') return methodNotAllowed('POST')
    return startExtraction(request, env)
  }

  const match = /^\/v1\/extractions\/([^/]+)$/.exec(url.pathname)
  if (match) {
    if (request.method !== 'GET') return methodNotAllowed('GET')
    return pollExtraction(decodeURIComponent(match[1]), env)
  }

  return jsonResponse(
    {
      status: 'failed',
      failureReason: 'Endpoint not found.',
    },
    404,
  )
}

export async function handleCloudflareExtractorQueue(
  batch: QueueBatchLike<ExtractionJobMessage>,
  env: CloudflareExtractorEnv,
): Promise<void> {
  if (batch.messages.length === 0) return

  // Batch-size-1 falls through to the historical single-PDF path. Preserves wire contract,
  // log shape, and existing observability for single-message queue deliveries.
  if (batch.messages.length === 1) {
    const message = batch.messages[0]
    try {
      await processExtractionJob(message.body, env)
      message.ack?.()
    } catch (error) {
      if (!message.retry) throw error
      message.retry()
    }
    return
  }

  // Batch-size>1 fan-outs into a single container POST at /internal/extract-batch.
  // The JVM uses kotlinx-coroutines supervisorScope so per-job failures stay isolated.
  await processExtractionBatch(batch, env)
}

async function processExtractionBatch(
  batch: QueueBatchLike<ExtractionJobMessage>,
  env: CloudflareExtractorEnv,
): Promise<void> {
  type Fetched =
    | {
        ok: true
        job: ExtractionJobMessage
        message: QueueBatchLike<ExtractionJobMessage>['messages'][number]
        pdfBase64: string
      }
    | {
        ok: false
        job: ExtractionJobMessage
        message: QueueBatchLike<ExtractionJobMessage>['messages'][number]
        reason: string
      }

  const fetched: Fetched[] = await Promise.all(
    batch.messages.map(async (message): Promise<Fetched> => {
      const job = message.body
      if (job.storageBucket !== env.UPLOAD_BUCKET_NAME) {
        return {
          ok: false,
          job,
          message,
          reason: `Extraction job referenced unsupported R2 bucket ${job.storageBucket}.`,
        }
      }
      try {
        const object = await env.UPLOAD_BUCKET.get(job.storageKey)
        if (!object?.body) {
          return { ok: false, job, message, reason: 'Uploaded PDF was not found in R2.' }
        }
        const pdfBytes = await new Response(object.body).arrayBuffer()
        return { ok: true, job, message, pdfBase64: arrayBufferToBase64(pdfBytes) }
      } catch (error) {
        return {
          ok: false,
          job,
          message,
          reason: error instanceof Error ? error.message : 'R2 fetch failed.',
        }
      }
    }),
  )

  // Fail-out the unreachable jobs before calling the container.
  for (const item of fetched) {
    if (item.ok) continue
    try {
      await putJobState(env, failedJob(item.job, item.reason))
      item.message.ack?.()
    } catch {
      item.message.retry?.()
    }
  }

  const eligible = fetched.filter((item): item is Extract<Fetched, { ok: true }> => item.ok)
  if (eligible.length === 0) return

  // Route the whole batch to one container instance keyed by sorted job ids. Deterministic
  // naming lets retries hit the same warm container when the batch shape is unchanged.
  const batchKey = `batch_${eligible
    .map((item) => item.job.jobId)
    .sort()
    .join('_')
    .slice(0, 64)}`

  let containerResponse: Response
  try {
    const container = env.KOTLIN_EXTRACTOR.getByName(batchKey)
    containerResponse = await container.fetch(
      new Request('https://kotlin-extractor.internal/internal/extract-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobs: eligible.map((item) => ({
            jobId: item.job.jobId,
            pdfBase64: item.pdfBase64,
          })),
        }),
      }),
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Kotlin extractor batch call failed.'
    for (const item of eligible) {
      try {
        await putJobState(env, failedJob(item.job, reason))
      } catch {
        // fall through to retry
      }
      item.message.retry?.()
    }
    return
  }

  if (!containerResponse.ok) {
    for (const item of eligible) {
      try {
        await putJobState(
          env,
          failedJob(item.job, `Kotlin extractor returned HTTP ${containerResponse.status}.`),
        )
        if (containerResponse.status >= 500) {
          item.message.retry?.()
        } else {
          item.message.ack?.()
        }
      } catch {
        item.message.retry?.()
      }
    }
    return
  }

  let payload: unknown
  try {
    payload = await containerResponse.json()
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Kotlin extractor returned invalid batch JSON.'
    for (const item of eligible) {
      try {
        await putJobState(env, failedJob(item.job, reason))
        item.message.ack?.()
      } catch {
        item.message.retry?.()
      }
    }
    return
  }

  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    for (const item of eligible) {
      try {
        await putJobState(
          env,
          failedJob(item.job, 'Kotlin extractor returned invalid batch JSON shape.'),
        )
        item.message.ack?.()
      } catch {
        item.message.retry?.()
      }
    }
    return
  }

  const resultByJobId = new Map<string, unknown>()
  for (const result of payload.results) {
    if (isRecord(result) && typeof result.jobId === 'string') {
      resultByJobId.set(result.jobId, result)
    }
  }

  for (const item of eligible) {
    const result = resultByJobId.get(item.job.jobId)
    if (!result || !isRecord(result)) {
      try {
        await putJobState(env, failedJob(item.job, 'Batch result missing for jobId.'))
        item.message.ack?.()
      } catch {
        item.message.retry?.()
      }
      continue
    }
    const normalized = normalizeWorkerPollResponse(result, item.job)
    try {
      await putJobState(env, {
        ...normalized,
        documentId: item.job.documentId,
        storageBucket: item.job.storageBucket,
        storageKey: item.job.storageKey,
        updatedAt: new Date().toISOString(),
      })
      item.message.ack?.()
    } catch {
      item.message.retry?.()
    }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  const chunks: string[] = []
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, Math.min(index + chunkSize, bytes.length))
    chunks.push(String.fromCharCode(...slice))
  }
  return btoa(chunks.join(''))
}

async function healthCheck(env: CloudflareExtractorEnv): Promise<Response> {
  const checkedAt = new Date().toISOString()
  const checks = {
    jobStateBucket: await checkJobStateBucket(env, checkedAt),
    uploadBucket: await checkUploadBucket(env),
    extractionQueue: {
      ok: typeof env.EXTRACTION_QUEUE?.send === 'function',
    },
    kotlinExtractor: {
      ok: typeof env.KOTLIN_EXTRACTOR?.getByName === 'function',
    },
  }
  const ok = Object.values(checks).every((check) => check.ok)

  return jsonResponse(
    {
      status: ok ? 'ok' : 'degraded',
      checkedAt,
      checks,
    },
    ok ? 200 : 503,
  )
}

async function checkJobStateBucket(
  env: CloudflareExtractorEnv,
  checkedAt: string,
): Promise<{ ok: boolean; error?: string }> {
  const probeId = `health_${crypto.randomUUID()}`

  try {
    await env.JOB_STATE_BUCKET.put(HEALTHCHECK_STATE_KEY, JSON.stringify({ probeId, checkedAt }), {
      httpMetadata: { contentType: 'application/json' },
    })
    const object = await env.JOB_STATE_BUCKET.get(HEALTHCHECK_STATE_KEY)
    const parsed = object?.text ? JSON.parse(await object.text()) : null

    return { ok: isRecord(parsed) && parsed.probeId === probeId }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'job_state_probe_failed' }
  }
}

async function checkUploadBucket(
  env: CloudflareExtractorEnv,
): Promise<{ ok: boolean; key: string | null; error?: string }> {
  const key = env.HEALTHCHECK_STORAGE_KEY?.trim()

  if (!key) {
    return {
      ok: false,
      key: null,
      error: 'HEALTHCHECK_STORAGE_KEY is not configured.',
    }
  }

  try {
    const object = await env.UPLOAD_BUCKET.get(key)
    return object?.body
      ? { ok: true, key }
      : { ok: false, key, error: 'Healthcheck storage object was not found.' }
  } catch (error) {
    return { ok: false, key, error: error instanceof Error ? error.message : 'upload_probe_failed' }
  }
}

async function startExtraction(request: Request, env: CloudflareExtractorEnv): Promise<Response> {
  const input = await readStartRequest(request)
  if (!input) {
    return jsonResponse(
      {
        status: 'failed',
        failureReason: 'Invalid extraction request.',
      },
      400,
    )
  }
  if (input.storageBucket !== env.UPLOAD_BUCKET_NAME) {
    return jsonResponse(
      {
        status: 'failed',
        failureReason: `Extraction request referenced unsupported R2 bucket ${input.storageBucket}.`,
      },
      400,
    )
  }

  const jobId = `cf_job_${safeIdentifier(input.documentId)}_${crypto.randomUUID()}`
  const message: ExtractionJobMessage = { jobId, ...input }
  await putJobState(env, {
    status: 'in_progress',
    jobId,
    documentId: input.documentId,
    storageBucket: input.storageBucket,
    storageKey: input.storageKey,
    updatedAt: new Date().toISOString(),
  })
  await env.EXTRACTION_QUEUE.send(message)
  return jsonResponse({ jobId }, 202)
}

async function pollExtraction(jobId: string, env: CloudflareExtractorEnv): Promise<Response> {
  const state = await getJobState(jobId, env)
  if (!state) {
    return jsonResponse(
      {
        status: 'failed',
        jobId,
        failureReason: 'Extraction job was not found.',
      },
      404,
    )
  }
  return jsonResponse(state, 200)
}

async function processExtractionJob(
  job: ExtractionJobMessage,
  env: CloudflareExtractorEnv,
): Promise<void> {
  if (job.storageBucket !== env.UPLOAD_BUCKET_NAME) {
    await putJobState(
      env,
      failedJob(job, `Extraction job referenced unsupported R2 bucket ${job.storageBucket}.`),
    )
    return
  }

  const object = await env.UPLOAD_BUCKET.get(job.storageKey)
  if (!object?.body) {
    await putJobState(env, failedJob(job, 'Uploaded PDF was not found in R2.'))
    return
  }

  try {
    const container = env.KOTLIN_EXTRACTOR.getByName(job.jobId)
    const response = await container.fetch(
      new Request(`https://kotlin-extractor.internal/internal/extract?jobId=${job.jobId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/pdf',
          'x-prizm-job-id': job.jobId,
        },
        body: object.body,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    )

    if (!response.ok) {
      await putJobState(env, failedJob(job, `Kotlin extractor returned HTTP ${response.status}.`))
      return
    }

    const output = normalizeWorkerPollResponse(await response.json(), job)
    await putJobState(env, {
      ...output,
      documentId: job.documentId,
      storageBucket: job.storageBucket,
      storageKey: job.storageKey,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    await putJobState(
      env,
      failedJob(job, error instanceof Error ? error.message : 'Kotlin extractor failed.'),
    )
  }
}

async function readStartRequest(request: Request): Promise<ExtractionStartRequest | null> {
  try {
    const body = await request.json()
    if (!isRecord(body)) return null
    if (typeof body.documentId !== 'string' || body.documentId.length === 0) return null
    if (typeof body.storageBucket !== 'string' || body.storageBucket.length === 0) return null
    if (typeof body.storageKey !== 'string' || body.storageKey.length === 0) return null
    return {
      documentId: body.documentId,
      storageBucket: body.storageBucket,
      storageKey: body.storageKey,
    }
  } catch {
    return null
  }
}

async function getJobState(jobId: string, env: CloudflareExtractorEnv): Promise<unknown | null> {
  const object = await env.JOB_STATE_BUCKET.get(jobStateKey(jobId))
  if (!object?.text) return null
  return JSON.parse(await object.text())
}

async function putJobState(env: CloudflareExtractorEnv, state: unknown): Promise<void> {
  if (!isRecord(state) || typeof state.jobId !== 'string') {
    throw new Error('invalid_job_state')
  }
  await env.JOB_STATE_BUCKET.put(jobStateKey(state.jobId), JSON.stringify(state), {
    httpMetadata: { contentType: 'application/json' },
  })
}

function normalizeWorkerPollResponse(
  output: unknown,
  job: ExtractionJobMessage,
): WorkerPollResponse {
  if (!isRecord(output)) return failedJob(job, 'Kotlin extractor returned invalid JSON.')
  if (output.status === 'failed') {
    return failedJob(
      job,
      typeof output.failureReason === 'string' ? output.failureReason : 'Kotlin extractor failed.',
    )
  }
  if (output.status !== 'succeeded' || !Array.isArray(output.statements)) {
    return failedJob(job, 'Kotlin extractor returned invalid normalized statement data.')
  }
  return {
    status: 'succeeded',
    jobId: job.jobId,
    statements: output.statements,
  }
}

function failedJob(job: ExtractionJobMessage, failureReason: string) {
  return {
    status: 'failed' as const,
    jobId: job.jobId,
    documentId: job.documentId,
    storageBucket: job.storageBucket,
    storageKey: job.storageKey,
    failureReason,
    updatedAt: new Date().toISOString(),
  }
}

async function isAuthorized(request: Request, env: CloudflareExtractorEnv): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  return timingSafeEqual(token, env.EXTRACTOR_TOKEN)
}

async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  if (!left || !right) return false
  const encoder = new TextEncoder()
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ])
  const leftBytes = new Uint8Array(leftDigest)
  const rightBytes = new Uint8Array(rightDigest)
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }
  return difference === 0
}

function methodNotAllowed(allowedMethod: string): Response {
  return jsonResponse(
    {
      status: 'failed',
      failureReason: 'Method not allowed.',
    },
    405,
    { allow: allowedMethod },
  )
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

function jobStateKey(jobId: string): string {
  return `${JOB_PREFIX}${jobId}.json`
}

function safeIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
