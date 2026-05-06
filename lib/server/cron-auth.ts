import 'server-only'

import { serverEnv } from '../shared/env'

export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = serverEnv.CRON_SECRET
  if (!secret) return false

  const authorization = request.headers.get('authorization')
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  const headerToken = request.headers.get('x-cron-secret')

  return bearerToken === secret || headerToken === secret
}
