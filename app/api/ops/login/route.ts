import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requestOpsLoginLink } from '@/lib/server/ops-login'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let email: unknown
  try {
    const body = await request.json()
    email = body?.email
  } catch {
    email = null
  }

  await requestOpsLoginLink({ email, request })

  return NextResponse.json({ ok: true })
}
