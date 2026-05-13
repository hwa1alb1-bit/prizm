import { describe, expect, it, vi } from 'vitest'
import {
  convertDocument,
  type ConversionDocument,
  type DocumentConversionDependencies,
} from '@/lib/server/document-conversion'

describe('convertDocument', () => {
  it('reserves one credit and starts extraction once for a verified document', async () => {
    const deps = createDependencies()

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
      extractionEngine: 'textract',
      extractionJobId: 'textract_job_123',
      textractJobId: 'textract_job_123',
      chargeStatus: 'reserved',
      alreadyStarted: false,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.reserveCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        workspaceId: 'workspace_123',
        costCredits: 1,
      }),
    )
    expect(deps.startExtraction).toHaveBeenCalledWith({
      documentId: 'doc_123',
      s3Bucket: 'prizm-uploads-test',
      s3Key: 'user_123/doc_123/statement.pdf',
      storageProvider: 's3',
      storageBucket: 'prizm-uploads-test',
      storageKey: 'user_123/doc_123/statement.pdf',
    })
    expect(deps.markProcessingStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        extractionEngine: 'textract',
        extractionJobId: 'textract_job_123',
        textractJobId: 'textract_job_123',
        chargeStatus: 'reserved',
      }),
    )
  })

  it('refuses conversion without starting Textract when credit reservation is insufficient', async () => {
    const deps = createDependencies()
    deps.reserveCredit.mockResolvedValueOnce({ ok: false, reason: 'insufficient_balance' })

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toMatchObject({
      ok: false,
      reason: 'insufficient_balance',
      status: 402,
      code: 'PRZM_CREDITS_INSUFFICIENT',
    })
    expect(deps.startExtraction).not.toHaveBeenCalled()
    expect(deps.markProcessingStarted).not.toHaveBeenCalled()
  })

  it('releases a reserved credit when extraction cannot be started', async () => {
    const deps = createDependencies()
    deps.startExtraction.mockRejectedValueOnce(new Error('engine_down'))

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toMatchObject({
      ok: false,
      reason: 'textract_start_failed',
      status: 502,
    })
    expect(deps.releaseCreditReservation).toHaveBeenCalledWith({
      documentId: 'doc_123',
      releasedAt: expect.any(String),
    })
    expect(deps.markProcessingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        failureReason: 'Extraction could not be started for the verified upload.',
      }),
    )
  })

  it('releases the reserved credit and marks failed when processing-state persistence fails after extraction starts', async () => {
    const deps = createDependencies()
    deps.markProcessingStarted.mockRejectedValueOnce(new Error('db_transition_failed'))

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toMatchObject({
      ok: false,
      reason: 'transition_failed',
      status: 500,
    })
    expect(deps.startExtraction).toHaveBeenCalled()
    expect(deps.releaseCreditReservation).toHaveBeenCalledWith({
      documentId: 'doc_123',
      releasedAt: expect.any(String),
    })
    expect(deps.markProcessingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        failureReason: 'Extraction started but the processing state could not be recorded safely.',
      }),
    )
  })

  it('returns the existing extraction job without reserving another credit', async () => {
    const deps = createDependencies({
      document: documentRow({
        status: 'processing',
        extractionEngine: 'textract',
        extractionJobId: 'textract_existing',
        textractJobId: 'textract_existing',
        chargeStatus: 'reserved',
      }),
    })

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
      extractionEngine: 'textract',
      extractionJobId: 'textract_existing',
      textractJobId: 'textract_existing',
      chargeStatus: 'reserved',
      alreadyStarted: true,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.reserveCredit).not.toHaveBeenCalled()
    expect(deps.startExtraction).not.toHaveBeenCalled()
  })

  it('does not expose an existing Cloudflare job through the Textract compatibility field', async () => {
    const deps = createDependencies({
      document: documentRow({
        status: 'processing',
        extractionEngine: 'cloudflare-r2',
        extractionJobId: 'cf_job_existing',
        textractJobId: null,
        chargeStatus: 'reserved',
      }),
    })

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
      extractionEngine: 'cloudflare-r2',
      extractionJobId: 'cf_job_existing',
      textractJobId: null,
      chargeStatus: 'reserved',
      alreadyStarted: true,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.reserveCredit).not.toHaveBeenCalled()
    expect(deps.startExtraction).not.toHaveBeenCalled()
  })

  it('does not expose worker job ids through the Textract compatibility field', async () => {
    const deps = createDependencies()
    deps.startExtraction.mockResolvedValueOnce({
      engine: 'kotlin_worker',
      jobId: 'worker_job_123',
    })

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
      extractionEngine: 'kotlin_worker',
      extractionJobId: 'worker_job_123',
      textractJobId: null,
      chargeStatus: 'reserved',
      alreadyStarted: false,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.markProcessingStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        extractionEngine: 'kotlin_worker',
        extractionJobId: 'worker_job_123',
        textractJobId: null,
      }),
    )
  })

  it('starts Cloudflare extraction with provider-neutral R2 storage identity', async () => {
    const deps = createDependencies({
      document: documentRow({
        storageProvider: 'r2',
        storageBucket: 'prizm-r2-uploads',
        storageKey: 'user_123/doc_123/statement.pdf',
        s3Bucket: 'prizm-r2-uploads',
        s3Key: 'user_123/doc_123/statement.pdf',
      }),
    })
    deps.startExtraction.mockResolvedValueOnce({
      engine: 'cloudflare-r2',
      jobId: 'cf_job_123',
    })

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toMatchObject({
      ok: true,
      extractionEngine: 'cloudflare-r2',
      extractionJobId: 'cf_job_123',
      textractJobId: null,
    })
    expect(deps.startExtraction).toHaveBeenCalledWith({
      documentId: 'doc_123',
      storageProvider: 'r2',
      storageBucket: 'prizm-r2-uploads',
      storageKey: 'user_123/doc_123/statement.pdf',
      s3Bucket: 'prizm-r2-uploads',
      s3Key: 'user_123/doc_123/statement.pdf',
    })
  })
})

function conversionInput() {
  return {
    documentId: 'doc_123',
    actorUserId: 'user_123',
    actorIp: '203.0.113.10',
    actorUserAgent: 'vitest',
    routeContext: {
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/doc_123/convert',
    },
  }
}

function createDependencies(overrides: { document?: ConversionDocument | null } = {}) {
  const deps = {
    getUserProfile: vi.fn().mockResolvedValue({
      workspaceId: 'workspace_123',
      role: 'member',
    }),
    getDocument: vi.fn().mockResolvedValue(overrides.document ?? documentRow()),
    reserveCredit: vi.fn().mockResolvedValue({ ok: true, chargeStatus: 'reserved' }),
    releaseCreditReservation: vi.fn().mockResolvedValue(undefined),
    startExtraction: vi.fn().mockResolvedValue({
      engine: 'textract',
      jobId: 'textract_job_123',
    }),
    markProcessingStarted: vi.fn().mockResolvedValue(undefined),
    markProcessingFailed: vi.fn().mockResolvedValue(undefined),
  } satisfies DocumentConversionDependencies
  return deps
}

function documentRow(overrides: Partial<ConversionDocument> = {}): ConversionDocument {
  return {
    id: 'doc_123',
    workspaceId: 'workspace_123',
    status: 'verified',
    s3Bucket: 'prizm-uploads-test',
    s3Key: 'user_123/doc_123/statement.pdf',
    storageProvider: 's3',
    storageBucket: 'prizm-uploads-test',
    storageKey: 'user_123/doc_123/statement.pdf',
    extractionEngine: null,
    extractionJobId: null,
    textractJobId: null,
    chargeStatus: 'quoted',
    conversionCostCredits: 1,
    failureReason: null,
    ...overrides,
  }
}
