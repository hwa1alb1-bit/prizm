import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isDev = process.env.NODE_ENV === 'development'

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${
      isDev ? " 'unsafe-eval'" : ''
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.sentry.io https://s3.amazonaws.com https://*.s3.amazonaws.com https://*.r2.cloudflarestorage.com",
    'frame-src https://js.stripe.com https://hooks.stripe.com',
    'upgrade-insecure-requests',
  ].join('; ')
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const withCsp = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  const path = request.nextUrl.pathname
  const isAppRoute = path.startsWith('/app')
  const isOpsRoute = path.startsWith('/ops') && path !== '/ops/login'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isAppRoute || isOpsRoute) {
      const url = request.nextUrl.clone()
      url.pathname = isOpsRoute ? '/ops/login' : '/login'
      url.searchParams.set('next', path)
      return withCsp(NextResponse.redirect(url))
    }

    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && (isAppRoute || isOpsRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = isOpsRoute ? '/ops/login' : '/login'
    url.searchParams.set('next', path)
    return withCsp(NextResponse.redirect(url))
  }

  if (user && (path === '/login' || path === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    return withCsp(NextResponse.redirect(url))
  }

  if (user && path === '/ops/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/ops'
    return withCsp(NextResponse.redirect(url))
  }

  return withCsp(supabaseResponse)
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|css|js)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
