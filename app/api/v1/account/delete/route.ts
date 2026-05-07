import { NextRequest } from 'next/server'
import { handlePrivacyRequestRoute } from '@/lib/server/privacy-request-route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<Response> {
  return handlePrivacyRequestRoute(req, {
    requestType: 'account_deletion',
    auditEventType: 'privacy.account_deletion.requested',
    failureSubject: 'account deletion',
    dueDays: 10,
  })
}
