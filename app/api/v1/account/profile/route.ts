import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { updateUserProfile } from '@/lib/server/account/profile'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const profileSchema = z.object({
  full_name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1).max(120)),
})

export async function PATCH(request: NextRequest): Promise<Response> {
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

  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCOUNT_PROFILE',
      title: 'Invalid profile update',
      detail: parsed.error.issues[0]?.message ?? 'Invalid input.',
    })
  }

  const result = await updateUserProfile({
    supabase: auth.context.supabase,
    userId: auth.context.user.id,
    fullName: parsed.data.full_name,
  })

  if (!result.ok) {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_ACCOUNT_PROFILE_UPDATE_FAILED',
      title: 'Profile could not be updated',
      detail: 'A profile update failed. Try again later.',
    })
  }

  return jsonResponse(context, {
    full_name: parsed.data.full_name,
    request_id: context.requestId,
    trace_id: context.traceId,
  })
}
