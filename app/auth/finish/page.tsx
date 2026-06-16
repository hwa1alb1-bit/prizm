'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/client/supabase'
import { normalizeAuthNextPath } from '@/lib/shared/auth-redirect'

type FinishStatus = 'working' | 'failed'

// Handles the implicit-flow tail of a Supabase email link. /auth/callback
// (server) forwards here when the URL has no PKCE ?code= — the access_token
// is in the URL fragment, which only the browser can see. createBrowserClient
// has detectSessionInUrl=true by default, so by the time getSession resolves
// the fragment has been consumed and a session is in storage.
function AuthFinishInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<FinishStatus>('working')

  useEffect(() => {
    let cancelled = false
    const next = normalizeAuthNextPath(searchParams.get('next')) ?? '/app'

    const finalize = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error || !data.session) {
          const params = new URLSearchParams({ error: 'auth_callback_failed' })
          if (error?.message) params.set('error_description', error.message)
          router.replace(`/login?${params.toString()}`)
          return
        }
        router.replace(next)
      } catch {
        if (cancelled) return
        setStatus('failed')
      }
    }

    void finalize()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  if (status === 'failed') {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Sign-in could not finish</h1>
        <p className="text-sm text-foreground/65">
          The link is no longer valid. Request a new one to continue.
        </p>
        <p className="pt-2 text-sm">
          <Link
            href="/forgot-password"
            className="font-medium underline text-foreground hover:text-foreground"
          >
            Request a new link
          </Link>
        </p>
      </div>
    )
  }

  return <p className="text-sm text-foreground/60">Finishing sign-in...</p>
}

export default function AuthFinishPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={<p className="text-sm text-foreground/60">Finishing sign-in...</p>}>
        <AuthFinishInner />
      </Suspense>
    </main>
  )
}
