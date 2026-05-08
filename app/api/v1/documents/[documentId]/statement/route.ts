import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { applyStatementEdit } from '@/lib/server/statement-edit'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const scalar = z.union([z.string(), z.number(), z.null()])
const metadataScalar = z.union([z.string(), z.number(), z.boolean(), z.null()])
const statementPatchSchema = z.object({
  statementType: z.enum(['bank', 'credit_card']).optional(),
  statement_type: z.enum(['bank', 'credit_card']).optional(),
  statementMetadata: z.record(z.string(), metadataScalar).optional(),
  statement_metadata: z.record(z.string(), metadataScalar).optional(),
  bankName: z.string().nullable().optional(),
  bank_name: z.string().nullable().optional(),
  accountLast4: z.string().nullable().optional(),
  account_last4: z.string().nullable().optional(),
  periodStart: z.string().nullable().optional(),
  period_start: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  openingBalance: scalar.optional(),
  opening_balance: scalar.optional(),
  closingBalance: scalar.optional(),
  closing_balance: scalar.optional(),
  reportedTotal: scalar.optional(),
  reported_total: scalar.optional(),
})
const transactionPatchSchema = z.object({
  id: z.string().min(1).optional(),
  postedAt: z.string().min(1).nullable().optional(),
  posted_at: z.string().min(1).nullable().optional(),
  date: z.string().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  amount: scalar.optional(),
  debit: scalar.optional(),
  credit: scalar.optional(),
  balance: scalar.optional(),
  payee: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  needsReview: z.boolean().optional(),
  needs_review: z.boolean().optional(),
  reviewReason: z.string().nullable().optional(),
  review_reason: z.string().nullable().optional(),
})

const editRequestSchema = z.object({
  expectedRevision: z.number().int().min(0),
  reviewed: z.boolean().optional(),
  statement: statementPatchSchema.optional(),
  operations: z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('update'),
          id: z.string().min(1),
          patch: transactionPatchSchema,
        }),
        z.object({
          type: z.literal('add'),
          row: transactionPatchSchema.extend({ id: z.string().min(1).optional() }),
        }),
        z.object({ type: z.literal('delete'), id: z.string().min(1) }),
      ]),
    )
    .default([]),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
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

  const parsed = editRequestSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_STATEMENT_EDIT',
      title: 'Invalid statement edit',
      detail: parsed.error.issues[0]?.message ?? 'Invalid statement edit.',
    })
  }

  const { documentId } = await params
  const result = await applyStatementEdit({
    documentId,
    actorUserId: auth.context.user.id,
    actorIp: getClientIp(request),
    actorUserAgent: request.headers.get('user-agent'),
    routeContext: context,
    ...parsed.data,
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
    documentId: result.documentId,
    statementId: result.statementId,
    revision: result.revision,
    reviewStatus: result.reviewStatus,
    transactions: result.transactions,
    request_id: result.requestId,
    trace_id: result.traceId,
  })
}
