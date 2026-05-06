import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordAuditEvent } from '@/lib/server/audit'
import { applyRouteHeaders, createRouteContext, getClientIp } from '@/lib/server/http'

export async function GET(request: NextRequest) {
  const context = createRouteContext(request)
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (next.startsWith('/ops')) {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const audit = await recordAuditEvent({
            eventType: 'ops.admin_login',
            actorUserId: user.id,
            targetType: 'ops_dashboard',
            metadata: {
              route: next,
              request_id: context.requestId,
              trace_id: context.traceId,
            },
            actorIp: getClientIp(request),
            actorUserAgent: request.headers.get('user-agent'),
          })

          if (!audit.ok) {
            return applyRouteHeaders(
              context,
              NextResponse.redirect(`${origin}/ops/login?error=ops_audit_failed`),
            )
          }
        }
      }

      return applyRouteHeaders(context, NextResponse.redirect(`${origin}${next}`))
    }
  }

  return applyRouteHeaders(
    context,
    NextResponse.redirect(`${origin}/login?error=auth_callback_failed`),
  )
}
