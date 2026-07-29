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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let verifyError: { code?: string; status?: number; message?: string } | null = null

  if (!supabaseUrl || !supabaseAnonKey) {
    verifyError = { message: 'Auth service is not configured' }
  } else {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
      })
      const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (result.error) {
        verifyError = {
          code: result.error.code,
          status: result.error.status,
          message: result.error.message,
        }
      }
    } catch (e) {
      verifyError = {
        message: e instanceof Error ? e.message : 'verifyOtp threw before completing',
      }
    }
  }

  if (verifyError) {
    console.error('[auth-confirm] verifyOtp failed', {
      type,
      ...verifyError,
      requestId: context.requestId,
    })
    const params = new URLSearchParams({ error: 'auth_callback_failed' })
    if (verifyError.message) params.set('error_description', verifyError.message)
    return applyRouteHeaders(context, NextResponse.redirect(`${origin}/login?${params.toString()}`))
  }

  return applyRouteHeaders(context, NextResponse.redirect(`${origin}${next}`))
}
