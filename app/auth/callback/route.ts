import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordAuditEvent } from '@/lib/server/audit'
import { applyRouteHeaders, createRouteContext, getClientIp } from '@/lib/server/http'
import { normalizeAuthNextPath } from '@/lib/shared/auth-redirect'

export async function GET(request: NextRequest) {
  const context = createRouteContext(request)
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error') ?? searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')
  const next = normalizeAuthNextPath(searchParams.get('next')) ?? '/app'

  // Supabase /verify can 303 back with an error (expired token, replay,
  // email scanner pre-fetch consuming the OTT). Forward to /login so the
  // user sees a useful message instead of a silent failure.
  if (errorParam) {
    const params = new URLSearchParams({ error: errorParam })
    if (errorDescription) params.set('error_description', errorDescription)
    return applyRouteHeaders(context, NextResponse.redirect(`${origin}/login?${params.toString()}`))
  }

  // PKCE flow: exchange the code for a session cookie server-side.
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
    if (error) {
      const params = new URLSearchParams({ error: 'auth_callback_failed' })
      if (error.message) params.set('error_description', error.message)
      return applyRouteHeaders(
        context,
        NextResponse.redirect(`${origin}/login?${params.toString()}`),
      )
    }

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

  // Implicit flow: token is in the URL fragment, invisible to the server.
  // Browsers preserve fragments across same-origin 303 redirects, so handing
  // off to a client page lets the Supabase JS detectSessionInUrl consume it.
  const handoff = new URL('/auth/finish', origin)
  handoff.searchParams.set('next', next)
  return applyRouteHeaders(context, NextResponse.redirect(handoff))
}
