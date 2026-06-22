import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { applyRouteHeaders, createRouteContext } from '@/lib/server/http'
import { normalizeAuthNextPath } from '@/lib/shared/auth-redirect'

const VALID_TYPES: ReadonlySet<EmailOtpType> = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value != null && VALID_TYPES.has(value as EmailOtpType)
}

export async function GET(request: NextRequest) {
  const context = createRouteContext(request)
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = normalizeAuthNextPath(searchParams.get('next')) ?? '/app'

  if (!tokenHash || !isEmailOtpType(type)) {
    return applyRouteHeaders(
      context,
      NextResponse.redirect(`${origin}/login?error=auth_callback_failed`),
    )
  }

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

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) {
    console.error('[auth-confirm] verifyOtp failed', {
      type,
      code: error.code,
      status: error.status,
      message: error.message,
      requestId: context.requestId,
    })
    const params = new URLSearchParams({ error: 'auth_callback_failed' })
    if (error.message) params.set('error_description', error.message)
    return applyRouteHeaders(
      context,
      NextResponse.redirect(`${origin}/login?${params.toString()}`),
    )
  }

  return applyRouteHeaders(context, NextResponse.redirect(`${origin}${next}`))
}
