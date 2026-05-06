import { NextRequest } from 'next/server'
import { handlePrivacyRequestRoute } from '@/lib/server/privacy-request-route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<Response> {
  return handlePrivacyRequestRoute(req, {
    requestType: 'data_export',
    auditEventType: 'privacy.data_export.requested',
    failureSubject: 'data export',
  })
}
