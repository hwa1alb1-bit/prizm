import { describe, expect, it, vi } from 'vitest'
import {
  handleCloudflareExtractorQueue,
  handleCloudflareExtractorRequest,
  type CloudflareExtractorEnv,
  type ExtractionJobMessage,
} from '@/workers/cloudflare-extractor/src/handlers'

describe('Cloudflare extractor Worker contract', () => {
  it('rejects unauthenticated extraction starts', async () => {
    const env = createEnv()

    const response = await handleCloudflareExtractorRequest(
      new Request('https://extractor.example.com/v1/extractions', {
        method: 'POST',
        body: JSON.stringify(extractionRequest()),
      }),
      env,
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      status: 'failed',
      failureReason: 'Unauthorized.',
    })
    expect(env.EXTRACTION_QUEUE.send).not.toHaveBeenCalled()
  })

  it('reports authenticated health only when bindings and storage probes are usable', async () => {
    const env = createEnv({ healthcheckStorageKey: 'uploads/probes/known-good.pdf' })
    await env.UPLOAD_BUCKET.put('uploads/probes/known-good.pdf', new Blob(['%PDF-test']))

    const response = await handleCloudflareExtractorRequest(
      new Request('https://extractor.example.com/v1/health', {
        headers: { authorization: 'Bearer test-token' },
      }),
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'ok',
      checks: {
        jobStateBucket: { ok: true },
        uploadBucket: { ok: true, key: 'uploads/probes/known-good.pdf' },
        extractionQueue: { ok: true },
        kotlinExtractor: { ok: true },
      },
    })
  })

  it('starts an authenticated extraction, records pending job state, and queues metadata only', async () => {
    const env = createEnv()

    const response = await handleCloudflareExtractorRequest(
      new Request('https://extractor.example.com/v1/extractions', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify(extractionRequest()),
      }),
      env,
    )

    expect(response.status).toBe(202)
    const body = await response.json()
    expect(body).toEqual({ jobId: expect.stringMatching(/^cf_job_doc_123_/) })

    const jobState = JSON.parse(env.JOB_STATE_BUCKET.objects.get(`jobs/${body.jobId}.json`) ?? '')
    expect(jobState).toMatchObject({
      status: 'in_progress',
      jobId: body.jobId,
      documentId: 'doc_123',
      storageBucket: 'prizm-r2-uploads',
      storageKey: 'uploads/doc_123/statement.pdf',
    })
    expect(env.EXTRACTION_QUEUE.send).toHaveBeenCalledWith({
      jobId: body.jobId,
      documentId: 'doc_123',
      storageBucket: 'prizm-r2-uploads',
      storageKey: 'uploads/doc_123/statement.pdf',
    })
  })

  it('rejects extraction starts for unsupported upload buckets', async () => {
    const env = createEnv()

    const response = await handleCloudflareExtractorRequest(
      new Request('https://extractor.example.com/v1/extractions', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({
          ...extractionRequest(),
          storageBucket: 'other-r2-uploads',
        }),
      }),
      env,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      status: 'failed',
      failureReason: 'Extraction request referenced unsupported R2 bucket other-r2-uploads.',
    })
    expect(env.JOB_STATE_BUCKET.put).not.toHaveBeenCalled()
    expect(env.EXTRACTION_QUEUE.send).not.toHaveBeenCalled()
  })

  it('returns current job state from the polling endpoint', async () => {
    const env = createEnv()
    await env.JOB_STATE_BUCKET.put(
      'jobs/cf_job_ready.json',
      JSON.stringify({
        status: 'succeeded',
        jobId: 'cf_job_ready',
        statements: [
          {
            statementType: 'bank',
            bankName: 'PRIZM Credit Union',
            accountLast4: '4242',
            periodStart: '2026-04-01',
            periodEnd: '2026-04-30',
            openingBalance: 100,
            closingBalance: 125,
            reportedTotal: 25,
            computedTotal: 25,
            reconciles: true,
            ready: true,
            confidence: { overall: 0.99, fields: 0.99, transactions: 0.99 },
            reviewFlags: [],
            metadata: {},
            transactions: [
              {
                date: '2026-04-03',
                description: 'Coffee Shop',
                amount: -5,
                confidence: 0.99,
              },
            ],
          },
        ],
      }),
    )

    const response = await handleCloudflareExtractorRequest(
      new Request('https://extractor.example.com/v1/extractions/cf_job_ready', {
        headers: { authorization: 'Bearer test-token' },
      }),
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'succeeded',
      jobId: 'cf_job_ready',
      statements: [expect.objectContaining({ bankName: 'PRIZM Credit Union' })],
    })
  })

  it('fails closed when a queued job references a missing R2 object', async () => {
    const env = createEnv()

    await handleCloudflareExtractorQueue(
      queueBatch([
        {
          jobId: 'cf_job_missing',
          documentId: 'doc_missing',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/missing.pdf',
        },
      ]),
      env,
    )

    const jobState = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_missing.json') ?? '')
    expect(jobState).toMatchObject({
      status: 'failed',
      jobId: 'cf_job_missing',
      failureReason: 'Uploaded PDF was not found in R2.',
    })
    expect(env.KOTLIN_EXTRACTOR.getByName).not.toHaveBeenCalled()
  })

  it('fails queued jobs that reference a different upload bucket', async () => {
    const env = createEnv()
    await env.UPLOAD_BUCKET.put('uploads/doc_123/statement.pdf', new Blob(['%PDF-test']))

    await handleCloudflareExtractorQueue(
      queueBatch([
        {
          jobId: 'cf_job_wrong_bucket',
          documentId: 'doc_123',
          storageBucket: 'other-r2-uploads',
          storageKey: 'uploads/doc_123/statement.pdf',
        },
      ]),
      env,
    )

    const jobState = JSON.parse(
      env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_wrong_bucket.json') ?? '',
    )
    expect(jobState).toMatchObject({
      status: 'failed',
      jobId: 'cf_job_wrong_bucket',
      storageBucket: 'other-r2-uploads',
      failureReason: 'Extraction job referenced unsupported R2 bucket other-r2-uploads.',
    })
    expect(env.UPLOAD_BUCKET.get).not.toHaveBeenCalled()
    expect(env.KOTLIN_EXTRACTOR.getByName).not.toHaveBeenCalled()
  })

  it('streams a queued R2 PDF to the Kotlin container and stores normalized results', async () => {
    const env = createEnv()
    await env.UPLOAD_BUCKET.put('uploads/doc_123/statement.pdf', new Blob(['%PDF-test']))

    await handleCloudflareExtractorQueue(
      queueBatch([
        {
          jobId: 'cf_job_doc_123',
          documentId: 'doc_123',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/doc_123/statement.pdf',
        },
      ]),
      env,
    )

    expect(env.KOTLIN_EXTRACTOR.getByName).toHaveBeenCalledWith('cf_job_doc_123')
    expect(env.container.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
      }),
    )
    const containerRequest = vi.mocked(env.container.fetch).mock.calls[0][0] as Request
    expect(new URL(containerRequest.url).pathname).toBe('/internal/extract')

    const jobState = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_doc_123.json') ?? '')
    expect(jobState).toMatchObject({
      status: 'succeeded',
      jobId: 'cf_job_doc_123',
      statements: [expect.objectContaining({ bankName: 'PRIZM Credit Union' })],
    })
  })

  it('keeps the queued job id authoritative when container output includes a different id', async () => {
    const env = createEnv()
    vi.mocked(env.container.fetch).mockResolvedValueOnce(
      Response.json({
        status: 'succeeded',
        jobId: 'cf_job_wrong',
        statements: [normalizedStatement()],
      }),
    )
    await env.UPLOAD_BUCKET.put('uploads/doc_123/statement.pdf', new Blob(['%PDF-test']))

    await handleCloudflareExtractorQueue(
      queueBatch([
        {
          jobId: 'cf_job_doc_123',
          documentId: 'doc_123',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/doc_123/statement.pdf',
        },
      ]),
      env,
    )

    const jobState = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_doc_123.json') ?? '')
    expect(jobState).toMatchObject({
      status: 'succeeded',
      jobId: 'cf_job_doc_123',
      statements: [expect.objectContaining({ bankName: 'PRIZM Credit Union' })],
    })
    expect(env.JOB_STATE_BUCKET.objects.has('jobs/cf_job_wrong.json')).toBe(false)
  })

  it('retries queued jobs when state storage fails so exhausted messages can reach the DLQ', async () => {
    const env = createEnv()
    vi.mocked(env.JOB_STATE_BUCKET.put).mockRejectedValueOnce(new Error('r2_write_failed'))
    const batch = queueBatch([
      {
        jobId: 'cf_job_retry',
        documentId: 'doc_retry',
        storageBucket: 'prizm-r2-uploads',
        storageKey: 'uploads/retry.pdf',
      },
    ])

    await handleCloudflareExtractorQueue(batch, env)

    expect(batch.messages[0].retry).toHaveBeenCalled()
    expect(batch.messages[0].ack).not.toHaveBeenCalled()
  })

  it('routes a multi-message queue batch to one container at /internal/extract-batch', async () => {
    const env = createEnv()
    await env.UPLOAD_BUCKET.put('uploads/a.pdf', new Blob(['%PDF-A']))
    await env.UPLOAD_BUCKET.put('uploads/b.pdf', new Blob(['%PDF-B']))
    vi.mocked(env.container.fetch).mockResolvedValueOnce(
      Response.json({
        results: [
          { status: 'succeeded', jobId: 'cf_job_a', statements: [normalizedStatement()] },
          { status: 'succeeded', jobId: 'cf_job_b', statements: [normalizedStatement()] },
        ],
      }),
    )

    await handleCloudflareExtractorQueue(
      queueBatch([
        {
          jobId: 'cf_job_a',
          documentId: 'doc_a',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/a.pdf',
        },
        {
          jobId: 'cf_job_b',
          documentId: 'doc_b',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/b.pdf',
        },
      ]),
      env,
    )

    expect(env.KOTLIN_EXTRACTOR.getByName).toHaveBeenCalledWith(
      expect.stringMatching(/^batch_cf_job_a_cf_job_b/),
    )
    const containerRequest = vi.mocked(env.container.fetch).mock.calls[0][0] as Request
    expect(new URL(containerRequest.url).pathname).toBe('/internal/extract-batch')

    const stateA = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_a.json') ?? '')
    const stateB = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_b.json') ?? '')
    expect(stateA).toMatchObject({ status: 'succeeded', jobId: 'cf_job_a' })
    expect(stateB).toMatchObject({ status: 'succeeded', jobId: 'cf_job_b' })
  })

  it('writes failed state for missing R2 objects in a batch but still processes eligible jobs', async () => {
    const env = createEnv()
    await env.UPLOAD_BUCKET.put('uploads/exists.pdf', new Blob(['%PDF-test']))
    vi.mocked(env.container.fetch).mockResolvedValueOnce(
      Response.json({
        results: [
          {
            status: 'succeeded',
            jobId: 'cf_job_exists',
            statements: [normalizedStatement()],
          },
        ],
      }),
    )

    await handleCloudflareExtractorQueue(
      queueBatch([
        {
          jobId: 'cf_job_exists',
          documentId: 'doc_exists',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/exists.pdf',
        },
        {
          jobId: 'cf_job_missing',
          documentId: 'doc_missing',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/missing.pdf',
        },
      ]),
      env,
    )

    const stateExists = JSON.parse(
      env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_exists.json') ?? '',
    )
    const stateMissing = JSON.parse(
      env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_missing.json') ?? '',
    )
    expect(stateExists).toMatchObject({ status: 'succeeded', jobId: 'cf_job_exists' })
    expect(stateMissing).toMatchObject({
      status: 'failed',
      jobId: 'cf_job_missing',
      failureReason: 'Uploaded PDF was not found in R2.',
    })
  })

  it('retries eligible batch messages when the container returns a 5xx', async () => {
    const env = createEnv()
    await env.UPLOAD_BUCKET.put('uploads/a.pdf', new Blob(['%PDF-A']))
    await env.UPLOAD_BUCKET.put('uploads/b.pdf', new Blob(['%PDF-B']))
    vi.mocked(env.container.fetch).mockResolvedValueOnce(
      new Response('upstream error', { status: 502 }),
    )
    const batch = queueBatch([
      {
        jobId: 'cf_job_a',
        documentId: 'doc_a',
        storageBucket: 'prizm-r2-uploads',
        storageKey: 'uploads/a.pdf',
      },
      {
        jobId: 'cf_job_b',
        documentId: 'doc_b',
        storageBucket: 'prizm-r2-uploads',
        storageKey: 'uploads/b.pdf',
      },
    ])

    await handleCloudflareExtractorQueue(batch, env)

    expect(batch.messages[0].retry).toHaveBeenCalled()
    expect(batch.messages[1].retry).toHaveBeenCalled()
    const stateA = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_a.json') ?? '')
    expect(stateA.failureReason).toMatch(/HTTP 502/)
  })

  it('maps batch results back to per-job state by jobId', async () => {
    const env = createEnv()
    await env.UPLOAD_BUCKET.put('uploads/a.pdf', new Blob(['%PDF-A']))
    await env.UPLOAD_BUCKET.put('uploads/b.pdf', new Blob(['%PDF-B']))
    vi.mocked(env.container.fetch).mockResolvedValueOnce(
      Response.json({
        results: [
          { status: 'succeeded', jobId: 'cf_job_b', statements: [normalizedStatement()] },
          {
            status: 'failed',
            jobId: 'cf_job_a',
            failureReason: 'Unsupported text statement layout.',
          },
        ],
      }),
    )

    await handleCloudflareExtractorQueue(
      queueBatch([
        {
          jobId: 'cf_job_a',
          documentId: 'doc_a',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/a.pdf',
        },
        {
          jobId: 'cf_job_b',
          documentId: 'doc_b',
          storageBucket: 'prizm-r2-uploads',
          storageKey: 'uploads/b.pdf',
        },
      ]),
      env,
    )

    const stateA = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_a.json') ?? '')
    const stateB = JSON.parse(env.JOB_STATE_BUCKET.objects.get('jobs/cf_job_b.json') ?? '')
    expect(stateA).toMatchObject({
      status: 'failed',
      jobId: 'cf_job_a',
      failureReason: 'Unsupported text statement layout.',
    })
    expect(stateB).toMatchObject({ status: 'succeeded', jobId: 'cf_job_b' })
  })
})

function extractionRequest() {
  return {
    documentId: 'doc_123',
    storageBucket: 'prizm-r2-uploads',
    storageKey: 'uploads/doc_123/statement.pdf',
  }
}

function queueBatch(messages: ExtractionJobMessage[]) {
  return {
    messages: messages.map((body) => ({ body, ack: vi.fn(), retry: vi.fn() })),
  }
}

function createEnv(options: { healthcheckStorageKey?: string } = {}) {
  const container = {
    fetch: vi.fn().mockResolvedValue(
      Response.json({
        status: 'succeeded',
        jobId: 'cf_job_doc_123',
        statements: [normalizedStatement()],
      }),
    ),
  }
  return {
    EXTRACTOR_TOKEN: 'test-token',
    UPLOAD_BUCKET_NAME: 'prizm-r2-uploads',
    HEALTHCHECK_STORAGE_KEY: options.healthcheckStorageKey,
    UPLOAD_BUCKET: memoryBucket(),
    JOB_STATE_BUCKET: memoryBucket(),
    EXTRACTION_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
    KOTLIN_EXTRACTOR: {
      getByName: vi.fn().mockReturnValue(container),
    },
    container,
  } satisfies CloudflareExtractorEnv & { container: typeof container }
}

function normalizedStatement() {
  return {
    statementType: 'bank',
    bankName: 'PRIZM Credit Union',
    accountLast4: '4242',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    openingBalance: 100,
    closingBalance: 125,
    reportedTotal: 25,
    computedTotal: 25,
    reconciles: true,
    ready: true,
    confidence: { overall: 0.99, fields: 0.99, transactions: 0.99 },
    reviewFlags: [],
    metadata: {},
    transactions: [
      {
        date: '2026-04-03',
        description: 'Coffee Shop',
        amount: -5,
        confidence: 0.99,
      },
    ],
  }
}

function memoryBucket() {
  const objects = new Map<string, string>()
  return {
    objects,
    get: vi.fn(async (key: string) => {
      const body = objects.get(key)
      if (typeof body === 'undefined') return null
      return {
        body: streamFromString(body),
        text: async () => body,
      }
    }),
    put: vi.fn(async (key: string, value: string | Blob | ReadableStream) => {
      if (typeof value === 'string') {
        objects.set(key, value)
        return
      }
      if (value instanceof Blob) {
        objects.set(key, await value.text())
        return
      }
      objects.set(key, await new Response(value).text())
    }),
  }
}

function streamFromString(value: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value))
      controller.close()
    },
  })
}
