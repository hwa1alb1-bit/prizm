import type { NextRequest } from 'next/server'
import { signOutFromCookies } from '@/lib/server/auth/signout'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)
  const result = await signOutFromCookies()

  if (!result.ok) {
    return problemResponse(context, {
      status: 502,
      code: 'PRZM_INTERNAL_AUTH_SIGNOUT_FAILED',
      title: 'Sign out failed',
      detail: 'A sign out could not complete. Try again.',
    })
  }

  return jsonResponse(context, {
    ok: true,
    request_id: context.requestId,
    trace_id: context.traceId,
  })
}
