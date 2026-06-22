'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/client/supabase'
import { normalizeAuthNextPath } from '@/lib/shared/auth-redirect'

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed:
    'We could not finish your sign-in link. Request a new one and click it from the same browser where you opened your inbox.',
  otp_expired: 'Your sign-in link expired. Request a new one to continue.',
  access_denied: 'Your sign-in link is no longer valid. Request a new one to continue.',
  ops_audit_failed: 'We could not record the admin sign-in. Try again or contact support.',
}

function describeAuthError(code: string | null, description: string | null): string | null {
  if (!code) return null
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  return description ?? 'Sign-in could not finish. Please try again.'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealPassword, setRevealPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkError = describeAuthError(
      params.get('error') ?? params.get('error_code'),
      params.get('error_description'),
    )
    if (linkError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormError(linkError)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (authError) {
      setFormError(authError.message)
      return
    }

    const next =
      normalizeAuthNextPath(new URLSearchParams(window.location.search).get('next')) ?? '/app'
    router.push(next)
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Sign in
        </p>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em]">
          Sign in to StatementStudio
        </h1>
        <p className="text-sm text-foreground/65">Email and password sign-in for your workspace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-semibold">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            placeholder="you@company.com"
            className="block h-11 w-full rounded-md border border-foreground/20 bg-background px-3 text-sm placeholder:text-foreground/40 focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="block text-sm font-semibold">
              Password
            </label>
            <button
              type="button"
              onClick={() => setRevealPassword((v) => !v)}
              className="text-xs font-medium text-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              {revealPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="password"
            type={revealPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="block h-11 w-full rounded-md border border-foreground/20 bg-background px-3 text-sm placeholder:text-foreground/40 focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </div>

        {formError ? (
          <div
            className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="block h-11 w-full rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="flex flex-col items-center gap-1 text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-foreground/70 underline hover:text-foreground"
          >
            Forgot password?
          </Link>
          <Link
            href="/forgot-password?firstTime=1"
            className="text-xs text-foreground/55 hover:text-foreground"
          >
            First time signing in? Set your password →
          </Link>
        </div>
      </form>

      <p className="text-center text-sm text-foreground/65">
        New to StatementStudio?{' '}
        <Link href="/register" className="font-medium underline hover:text-foreground">
          Create account
        </Link>
      </p>
    </div>
  )
}
