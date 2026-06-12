'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/client/supabase'
import { PASSWORD_HINT, validatePassword } from '@/lib/auth/password'

type SessionStatus = 'checking' | 'authenticated' | 'expired'

export default function ResetPage() {
  const router = useRouter()
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [password, setPassword] = useState('')
  const [revealPassword, setRevealPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setStatus(data.user ? 'authenticated' : 'expired')
    })
    return () => {
      mounted = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setFormError(null)

    const policy = validatePassword(password)
    if (!policy.ok) {
      setPasswordError(policy.reason)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (authError) {
      setFormError(authError.message)
      return
    }
    router.push('/app')
  }

  if (status === 'checking') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-foreground/60">Checking reset link...</p>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Reset password
        </p>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em]">
          Reset link expired or invalid
        </h1>
        <p className="text-sm text-foreground/65">
          The reset link is no longer valid. Request a new one to choose your password.
        </p>
        <p className="pt-2 text-sm">
          <Link
            href="/forgot-password"
            className="font-medium underline text-foreground hover:text-foreground"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Choose new password
        </p>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em]">
          Choose a new password
        </h1>
        <p className="text-sm text-foreground/65">
          This will replace your existing password and sign you in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="block text-sm font-semibold">
              New password
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
            autoFocus
            autoComplete="new-password"
            aria-describedby="password-hint"
            className="block h-11 w-full rounded-md border border-foreground/20 bg-background px-3 text-sm placeholder:text-foreground/40 focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
          <p id="password-hint" className="text-xs text-foreground/55">
            {PASSWORD_HINT}
          </p>
          {passwordError ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {passwordError}
            </p>
          ) : null}
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
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
