import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { requestEmailChange } from '@/lib/server/account/email'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const emailSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email()),
})

export async function POST(request: NextRequest): Promise<Response> {
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

  const parsed = emailSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCOUNT_EMAIL',
      title: 'Invalid email',
      detail: parsed.error.issues[0]?.message ?? 'Invalid input.',
    })
  }

  const newEmail = parsed.data.email
  const currentEmail = auth.context.user.email?.toLowerCase() ?? null
  if (currentEmail === newEmail) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCOUNT_EMAIL_UNCHANGED',
      title: 'Email is unchanged',
      detail: 'Pick an email different from the current sign-in email.',
    })
  }

  const result = await requestEmailChange({
    supabase: auth.context.supabase,
    email: newEmail,
  })

  if (!result.ok) {
    return problemResponse(context, {
      status: 502,
      code: 'PRZM_INTERNAL_ACCOUNT_EMAIL_CHANGE_FAILED',
      title: 'Email change could not be requested',
      detail: result.reason,
    })
  }

  return jsonResponse(context, {
    pending_email: newEmail,
    request_id: context.requestId,
    trace_id: context.traceId,
  })
}
