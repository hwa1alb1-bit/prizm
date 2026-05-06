import type { NextRequest } from 'next/server'
import { attestOpsAdminAccessReview } from '@/lib/server/evidence/soc2'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireOpsAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AccessReviewBody = {
  reviewId?: unknown
  status?: unknown
  note?: unknown
}

export async function POST(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)
  const auth = await requireOpsAdminUser()

  if (!auth.ok) {
    return problemResponse(context, auth.problem)
  }

  const body = await readBody(request)
  if (!body.ok) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCESS_REVIEW_INVALID',
      title: 'Invalid access review attestation',
      detail: 'A review ID and approved or changes_required status are required.',
    })
  }

  try {
    const result = await attestOpsAdminAccessReview({
      reviewId: body.value.reviewId,
      status: body.value.status,
      note: body.value.note,
      reviewedBy: auth.context.user.id,
      routeContext: context,
      actorIp: getClientIp(request),
      actorUserAgent: request.headers.get('user-agent'),
    })

    return jsonResponse(
      context,
      {
        ...result,
        request_id: context.requestId,
        trace_id: context.traceId,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_ACCESS_REVIEW_ATTESTATION_FAILED',
      title: 'Access review attestation failed',
      detail: 'The ops admin access review could not be attested.',
    })
  }
}

async function readBody(request: Request): Promise<
  | {
      ok: true
      value: {
        reviewId: string
        status: 'approved' | 'changes_required'
        note: string | null
      }
    }
  | { ok: false }
> {
  try {
    const body = (await request.json()) as AccessReviewBody
    if (typeof body.reviewId !== 'string' || body.reviewId.trim().length === 0) {
      return { ok: false }
    }
    if (body.status !== 'approved' && body.status !== 'changes_required') {
      return { ok: false }
    }
    if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
      return { ok: false }
    }

    return {
      ok: true,
      value: {
        reviewId: body.reviewId,
        status: body.status,
        note: body.note?.trim() || null,
      },
    }
  } catch {
    return { ok: false }
  }
}
