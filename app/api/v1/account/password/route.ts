import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { changeAccountPassword } from '@/lib/server/account/password'
import { validatePassword } from '@/lib/auth/password'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
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

  const parsed = passwordSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCOUNT_PASSWORD',
      title: 'Invalid password change request',
      detail: parsed.error.issues[0]?.message ?? 'Invalid input.',
    })
  }

  const policy = validatePassword(parsed.data.newPassword)
  if (!policy.ok) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCOUNT_PASSWORD_POLICY',
      title: 'Password does not meet the policy',
      detail: policy.reason,
    })
  }

  const email = auth.context.user.email
  if (!email) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCOUNT_PASSWORD_NO_EMAIL',
      title: 'Email is required',
      detail: 'The signed-in account has no verified email to re-authenticate against.',
    })
  }

  const result = await changeAccountPassword({
    supabase: auth.context.supabase,
    email,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  })

  if (!result.ok) {
    if (result.reason === 'invalid_current') {
      return problemResponse(context, {
        status: 401,
        code: 'PRZM_AUTH_INVALID_CURRENT_PASSWORD',
        title: 'Current password is incorrect',
        detail: 'Enter the current password before choosing a new one.',
      })
    }
    return problemResponse(context, {
      status: 502,
      code: 'PRZM_INTERNAL_ACCOUNT_PASSWORD_CHANGE_FAILED',
      title: 'Password could not be changed',
      detail: result.reason,
    })
  }

  return jsonResponse(context, {
    ok: true,
    request_id: context.requestId,
    trace_id: context.traceId,
  })
}
