'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/client/supabase'
import { buildAuthConfirmUrl } from '@/lib/shared/auth-redirect'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [firstTime, setFirstTime] = useState(false)

  useEffect(() => {
    // URL-derived state, read once after hydration so SSR and client agree.
    const params = new URLSearchParams(window.location.search)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstTime(params.get('firstTime') === '1')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthConfirmUrl({
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        fallbackOrigin: window.location.origin,
        next: '/reset',
      }),
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
          Reset password
        </p>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em]">Check your inbox</h1>
        <p className="text-sm text-foreground/65">
          Check <strong className="text-foreground">{email}</strong> for the reset link.
        </p>
        <p className="text-sm text-foreground/60">The link expires in 60 minutes.</p>
        <p className="text-sm text-foreground/55">
          Cannot find it? Look in spam, then open the link in the same browser where you requested
          it so your new password applies.
        </p>
        <p className="pt-2 text-sm text-foreground/65">
          <Link href="/login" className="font-medium underline hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          {firstTime ? 'Set password' : 'Reset password'}
        </p>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em]">
          {firstTime ? 'Set your password' : 'Reset your password'}
        </h1>
        <p className="text-sm text-foreground/65">
          {firstTime
            ? 'Enter your email to finish your account setup. We will send a link to choose a password.'
            : "Enter your email and we'll send a reset link."}
        </p>
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
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm text-foreground/65">
        <Link href="/login" className="font-medium underline hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
