'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/client/supabase'
import { buildAuthCallbackUrl } from '@/lib/shared/auth-redirect'
import { PASSWORD_HINT, validatePassword } from '@/lib/auth/password'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealPassword, setRevealPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

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
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildAuthCallbackUrl({
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
          fallbackOrigin: window.location.origin,
        }),
      },
    })

    setLoading(false)
    if (authError) {
      setFormError(authError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Verify email
        </p>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em]">Check your email</h1>
        <p className="text-sm text-foreground/65">
          We sent a verification link to <strong className="text-foreground">{email}</strong>.
        </p>
        <p className="text-sm text-foreground/60">
          Click the link to finish creating your account. Free conversions start as soon as your
          email is verified.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Create account
        </p>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em]">
          Create your StatementStudio account
        </h1>
        <p className="text-sm text-foreground/65">
          Free conversions start as soon as your email is verified.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-semibold">
            Work email
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
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-foreground/65">
        Already have an account?{' '}
        <Link href="/login" className="font-medium underline hover:text-foreground">
          Sign in
        </Link>
      </p>
    </div>
  )
}
