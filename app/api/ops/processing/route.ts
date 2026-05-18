import type { NextRequest } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/server/cron-auth'
import { processExtractionDocuments } from '@/lib/server/document-processing'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  return processingFromAuthorizedRequest(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return processingFromAuthorizedRequest(request)
}

async function processingFromAuthorizedRequest(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)

  if (!isAuthorizedCronRequest(request)) {
    return problemResponse(context, {
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      title: 'Cron authorization required',
      detail: 'A valid cron secret is required to poll document processing.',
    })
  }

  try {
    const documentRequest = await documentIdFromRequest(request)
    if (!documentRequest.ok) {
      return problemResponse(context, {
        status: 400,
        code: 'PRZM_OPS_PROCESSING_DOCUMENT_ID_INVALID',
        title: 'Document ID is invalid',
        detail: documentRequest.detail,
      })
    }

    const documentId = documentRequest.documentId
    const result = await processExtractionDocuments(
      documentId
        ? {
            trigger: 'manual',
            limit: 1,
            documentId,
            routeContext: context,
          }
        : {
            trigger: 'cron',
            routeContext: context,
          },
    )
    return jsonResponse(
      context,
      {
        ...result,
        request_id: context.requestId,
        trace_id: context.traceId,
      },
      {
        status: result.status === 'failed' ? 500 : 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_PROCESSING_POLL_FAILED',
      title: 'Processing poll failed',
      detail:
        'Document processing could not be polled. Failed documents will release reservations.',
    })
  }
}

type DocumentIdRequest = { ok: true; documentId: string | null } | { ok: false; detail: string }

async function documentIdFromRequest(request: NextRequest): Promise<DocumentIdRequest> {
  const queryDocumentId = new URL(request.url).searchParams.get('documentId')
  if (queryDocumentId !== null) return parseDocumentId(queryDocumentId)
  if (request.method === 'GET') return { ok: true, documentId: null }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return { ok: true, documentId: null }
  }

  const body = (await request.json().catch(() => null)) as unknown
  if (!isRecord(body)) {
    return { ok: false, detail: 'JSON body must be an object.' }
  }
  if (!('documentId' in body)) return { ok: true, documentId: null }
  return parseDocumentId(body.documentId)
}

function parseDocumentId(value: unknown): DocumentIdRequest {
  if (typeof value !== 'string') {
    return { ok: false, detail: 'documentId must be a non-empty string.' }
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { ok: false, detail: 'documentId must be a non-empty string.' }
  }
  return { ok: true, documentId: trimmed }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
