import 'server-only'

import type { NextRequest } from 'next/server'
import { recordAuditEvent } from './audit'
import { getClientIp } from './http'
import { rateLimit } from './ratelimit'
import { captureException } from './sentry'
import { getServiceRoleClient } from './supabase'
import { buildAuthCallbackUrl } from '../shared/auth-redirect'
import { isOpsAdminEmailAllowlisted, normalizeOpsAdminEmail } from './ops-admin-allowlist'

const OPS_LOGIN_LIMIT = 5
const OPS_LOGIN_WINDOW_SEC = 300

export type OpsLoginRequestResult = {
  ok: true
}

export async function requestOpsLoginLink({
  email,
  request,
}: {
  email: unknown
  request: NextRequest | Request
}): Promise<OpsLoginRequestResult> {
  const normalizedEmail = normalizeOpsAdminEmail(email)
  const actorIp = getClientIp(request)
  const actorUserAgent = request.headers.get('user-agent')

  const rateLimitResult = await applyOpsLoginRateLimit(actorIp, normalizedEmail)
  if (rateLimitResult.limited) {
    await auditOpsLoginRequest({
      eventType: 'ops.login_link_rate_limited',
      email: normalizedEmail,
      actorIp,
      actorUserAgent,
      reason: rateLimitResult.reason,
    })
    return { ok: true }
  }

  if (!normalizedEmail || !isOpsAdminEmailAllowlisted(normalizedEmail)) {
    await auditOpsLoginRequest({
      eventType: 'ops.login_link_denied',
      email: normalizedEmail,
      actorIp,
      actorUserAgent,
      reason: normalizedEmail ? 'email_not_allowlisted' : 'invalid_email',
    })
    return { ok: true }
  }

  try {
    const client = getServiceRoleClient()
    const { data: profile, error: profileError } = await client
      .from('user_profile')
      .select('id')
      .eq('email_normalized', normalizedEmail)
      .maybeSingle()

    if (profileError || !profile) {
      await auditOpsLoginRequest({
        eventType: 'ops.login_link_denied',
        email: normalizedEmail,
        actorIp,
        actorUserAgent,
        reason: profileError ? 'profile_lookup_failed' : 'profile_not_found',
      })
      return { ok: true }
    }

    const { data: opsAdmin, error: opsAdminError } = await client
      .from('ops_admin')
      .select('role')
      .eq('user_id', profile.id)
      .is('revoked_at', null)
      .maybeSingle()

    if (opsAdminError || !opsAdmin || (opsAdmin.role !== 'owner' && opsAdmin.role !== 'admin')) {
      await auditOpsLoginRequest({
        eventType: 'ops.login_link_denied',
        email: normalizedEmail,
        actorIp,
        actorUserAgent,
        actorUserId: profile.id,
        reason: opsAdminError ? 'ops_admin_lookup_failed' : 'ops_admin_not_active',
      })
      return { ok: true }
    }

    const { error: authError } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl({
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
          fallbackOrigin: new URL(request.url).origin,
          next: '/ops',
        }),
        shouldCreateUser: false,
      },
    })

    await auditOpsLoginRequest({
      eventType: authError ? 'ops.login_link_denied' : 'ops.login_link_sent',
      email: normalizedEmail,
      actorIp,
      actorUserAgent,
      actorUserId: profile.id,
      reason: authError ? 'otp_send_failed' : 'sent',
    })
  } catch (err) {
    captureException(err, {
      route: '/api/ops/login',
      phase: 'ops-login-authorization',
    })
    await auditOpsLoginRequest({
      eventType: 'ops.login_link_denied',
      email: normalizedEmail,
      actorIp,
      actorUserAgent,
      reason: 'ops_authorization_unavailable',
    })
  }

  return { ok: true }
}

async function applyOpsLoginRateLimit(
  actorIp: string | null,
  normalizedEmail: string | null,
): Promise<{ limited: boolean; reason: string }> {
  try {
    const ipLimit = await rateLimit(
      `ops-login:ip:${actorIp ?? 'unknown'}`,
      OPS_LOGIN_LIMIT,
      OPS_LOGIN_WINDOW_SEC,
    )
    if (!ipLimit.success) return { limited: true, reason: 'ip_rate_limited' }

    const emailLimit = await rateLimit(
      `ops-login:email:${normalizedEmail ?? 'invalid'}`,
      OPS_LOGIN_LIMIT,
      OPS_LOGIN_WINDOW_SEC,
    )
    if (!emailLimit.success) return { limited: true, reason: 'email_rate_limited' }
  } catch (err) {
    captureException(err, {
      route: '/api/ops/login',
      rateLimitPolicy: 'ops-login',
    })
  }

  return { limited: false, reason: 'not_limited' }
}

async function auditOpsLoginRequest({
  eventType,
  email,
  actorIp,
  actorUserAgent,
  actorUserId,
  reason,
}: {
  eventType: string
  email: string | null
  actorIp: string | null
  actorUserAgent: string | null
  actorUserId?: string | null
  reason: string
}): Promise<void> {
  await recordAuditEvent({
    eventType,
    actorUserId: actorUserId ?? null,
    targetType: 'ops_login',
    metadata: {
      email,
      reason,
    },
    actorIp,
    actorUserAgent,
  })
}
