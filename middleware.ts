import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
      return NextResponse.redirect(url)
    }

    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
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
    return NextResponse.redirect(url)
  }

  if (user && (path === '/login' || path === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    return NextResponse.redirect(url)
  }

  if (user && path === '/ops/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/ops'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/app/:path*', '/ops/:path*', '/login', '/register'],
}
