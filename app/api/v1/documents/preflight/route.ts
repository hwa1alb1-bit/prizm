import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { preflightDocumentUpload } from '@/lib/server/document-preflight'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

const MAX_FILE_BYTES = 20 * 1024 * 1024

const requestSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .transform((s) => s.replace(/[^a-zA-Z0-9._-]/g, '_')),
  contentType: z.literal('application/pdf'),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  fileSha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .transform((value) => value.toLowerCase()),
})

export async function POST(request: NextRequest) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()

  if (!auth.ok) return problemResponse(context, auth.problem)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_INVALID_JSON',
      title: 'Invalid JSON',
      detail: 'The request body must be valid JSON.',
    })
  }

  if (Array.isArray(body)) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_BATCH_UNSUPPORTED',
      title: 'Batch preflight is not supported',
      detail: 'Submit exactly one PDF preflight request.',
    })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_PREFLIGHT_REQUEST',
      title: 'Invalid preflight request',
      detail: parsed.error.issues[0]?.message ?? 'Invalid input.',
    })
  }

  const result = await preflightDocumentUpload({
    ...parsed.data,
    actorUserId: auth.context.user.id,
    routeContext: context,
  })

  if (!result.ok) {
    return problemResponse(context, {
      status: result.status,
      code: result.code,
      title: result.title,
      detail: result.detail,
    })
  }

  return jsonResponse(context, {
    quote: result.quote,
    currentBalance: result.currentBalance,
    canConvert: result.canConvert,
    duplicate: result.duplicate,
    request_id: result.requestId,
    trace_id: result.traceId,
  })
}
