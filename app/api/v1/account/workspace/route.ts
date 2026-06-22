import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { updateWorkspaceName } from '@/lib/server/account/workspace'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireOwnerOrAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const workspaceSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1).max(120)),
})

export async function PATCH(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)
  const auth = await requireOwnerOrAdminUser()
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

  const parsed = workspaceSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_ACCOUNT_WORKSPACE',
      title: 'Invalid workspace update',
      detail: parsed.error.issues[0]?.message ?? 'Invalid input.',
    })
  }

  const result = await updateWorkspaceName({
    supabase: auth.context.supabase,
    workspaceId: auth.context.profile.workspace_id,
    name: parsed.data.name,
  })

  if (!result.ok) {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_ACCOUNT_WORKSPACE_UPDATE_FAILED',
      title: 'Workspace could not be updated',
      detail: 'A workspace update failed. Try again later.',
    })
  }

  return jsonResponse(context, {
    name: parsed.data.name,
    request_id: context.requestId,
    trace_id: context.traceId,
  })
}
