import { describe, expect, it, vi } from 'vitest'
import {
  convertDocument,
  type ConversionDocument,
  type DocumentConversionDependencies,
} from '@/lib/server/document-conversion'

describe('convertDocument', () => {
  it('reserves one credit and starts Textract once for a verified document', async () => {
    const deps = createDependencies()

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
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
    expect(deps.startTextractAnalysis).toHaveBeenCalledWith({
      documentId: 'doc_123',
      s3Bucket: 'prizm-uploads-test',
      s3Key: 'user_123/doc_123/statement.pdf',
    })
    expect(deps.markProcessingStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
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
    expect(deps.startTextractAnalysis).not.toHaveBeenCalled()
    expect(deps.markProcessingStarted).not.toHaveBeenCalled()
  })

  it('returns the existing Textract job without reserving another credit', async () => {
    const deps = createDependencies({
      document: documentRow({
        status: 'processing',
        textractJobId: 'textract_existing',
        chargeStatus: 'reserved',
      }),
    })

    const result = await convertDocument(conversionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
      textractJobId: 'textract_existing',
      chargeStatus: 'reserved',
      alreadyStarted: true,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.reserveCredit).not.toHaveBeenCalled()
    expect(deps.startTextractAnalysis).not.toHaveBeenCalled()
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
    startTextractAnalysis: vi.fn().mockResolvedValue('textract_job_123'),
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
    textractJobId: null,
    chargeStatus: 'quoted',
    conversionCostCredits: 1,
    failureReason: null,
    ...overrides,
  }
}
