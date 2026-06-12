'use client'

import { useState } from 'react'
import { PASSWORD_HINT, validatePassword } from '@/lib/auth/password'
import type { BillingSummary } from '@/lib/shared/billing'
import type { SettingsSummary } from '@/lib/shared/settings'

type AccountFormProps = {
  settings: SettingsSummary
  billing: BillingSummary
}

export function AccountForm({ settings, billing }: AccountFormProps) {
  const [fullName, setFullName] = useState<string>(settings.account.fullName ?? '')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState<string>(settings.workspace.name)
  const canEditWorkspace =
    settings.account.role === 'owner' || settings.account.role === 'admin'

  async function saveFullName(value: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const response = await fetch('/api/v1/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: value }),
    })
    if (!response.ok) return readProblem(response)
    const body = (await response.json().catch(() => ({}))) as { full_name?: string }
    if (body.full_name) setFullName(body.full_name)
    return { ok: true }
  }

  async function saveEmail(value: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const response = await fetch('/api/v1/account/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: value }),
    })
    if (!response.ok) return readProblem(response)
    const body = (await response.json().catch(() => ({}))) as { pending_email?: string }
    if (body.pending_email) setPendingEmail(body.pending_email)
    return { ok: true }
  }

  async function saveWorkspaceName(
    value: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const response = await fetch('/api/v1/account/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: value }),
    })
    if (!response.ok) return readProblem(response)
    const body = (await response.json().catch(() => ({}))) as { name?: string }
    if (body.name) setWorkspaceName(body.name)
    return { ok: true }
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="account-section-heading"
        className="rounded-lg border border-foreground/10 p-5"
      >
        <h2 id="account-section-heading" className="text-base font-semibold">
          Account
        </h2>
        {pendingEmail ? (
          <div
            role="status"
            className="mt-4 rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900"
          >
            <p className="font-semibold">Pending verification</p>
            <p className="mt-1">
              Check <span className="font-medium">{pendingEmail}</span> for the confirmation link.
              Until you click it, your sign-in email stays{' '}
              <span className="font-medium">{settings.account.email}</span>.
            </p>
          </div>
        ) : null}
        <dl className="mt-4 space-y-4 text-sm">
          <EditableRow
            label="Full name"
            displayValue={fullName.trim().length > 0 ? fullName : 'Not set'}
            initialEditValue={fullName}
            inputType="text"
            inputProps={{ maxLength: 120, autoComplete: 'name' }}
            onSave={saveFullName}
            editButtonLabel="Edit full name"
          />
          <EditableRow
            label="Email"
            displayValue={settings.account.email}
            initialEditValue={settings.account.email}
            inputType="email"
            inputProps={{ autoComplete: 'email' }}
            onSave={saveEmail}
            editButtonLabel="Edit email"
          />
          {canEditWorkspace ? (
            <EditableRow
              label="Workspace name"
              displayValue={workspaceName}
              initialEditValue={workspaceName}
              inputType="text"
              inputProps={{ maxLength: 120, autoComplete: 'organization' }}
              onSave={saveWorkspaceName}
              editButtonLabel="Edit workspace name"
            />
          ) : (
            <ReadOnlyRow label="Workspace" value={workspaceName} />
          )}
          <ReadOnlyRow label="Role" value={settings.account.role} />
        </dl>
        <div className="mt-6 border-t border-foreground/5 pt-4">
          <PasswordChangeRow />
        </div>
        <div className="mt-6 border-t border-foreground/5 pt-4">
          <SignOutRow />
        </div>
      </section>

      <section
        aria-labelledby="billing-section-heading"
        className="rounded-lg border border-foreground/10 p-5"
      >
        <h2 id="billing-section-heading" className="text-base font-semibold">
          Billing Details
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <ReadOnlyRow label="Plan" value={billing.plan} />
          <ReadOnlyRow label="Status" value={billing.status} />
          <ReadOnlyRow
            label="Credits"
            value={`${billing.usedCredits} / ${billing.monthlyCredits} used this period`}
          />
          <ReadOnlyRow
            label="Renews"
            value={billing.currentPeriodEnd ? billing.currentPeriodEnd.slice(0, 10) : 'No renewal'}
          />
        </dl>
      </section>
    </div>
  )
}

type EditableRowProps = {
  label: string
  displayValue: string
  initialEditValue: string
  inputType: 'text' | 'email'
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  onSave: (value: string) => Promise<{ ok: true } | { ok: false; message: string }>
  editButtonLabel: string
}

function EditableRow({
  label,
  displayValue,
  initialEditValue,
  inputType,
  inputProps,
  onSave,
  editButtonLabel,
}: EditableRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialEditValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setDraft(initialEditValue)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setDraft(initialEditValue)
    setError(null)
    setEditing(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await onSave(draft.trim())
    setSaving(false)
    if (result.ok) {
      setEditing(false)
      return
    }
    setError(result.message)
  }

  const inputId = `account-row-${label.replace(/\s+/g, '-').toLowerCase()}`

  if (editing) {
    return (
      <div className="border-b border-foreground/5 pb-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <label htmlFor={inputId} className="text-foreground/50">
            {label}
          </label>
          <input
            id={inputId}
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="block h-10 w-full rounded-md border border-foreground/20 bg-background px-3 text-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            {...inputProps}
          />
          {error ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-md bg-foreground px-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-md border border-foreground/20 px-3 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-4 border-b border-foreground/5 pb-4">
      <div>
        <dt className="text-foreground/50">{label}</dt>
        <dd className="mt-0.5 break-words font-medium">{displayValue}</dd>
      </div>
      <button
        type="button"
        onClick={startEdit}
        aria-label={editButtonLabel}
        className="text-xs font-semibold text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Edit
      </button>
    </div>
  )
}

function PasswordChangeRow() {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [revealCurrent, setRevealCurrent] = useState(false)
  const [revealNew, setRevealNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function reset() {
    setCurrentPassword('')
    setNewPassword('')
    setRevealCurrent(false)
    setRevealNew(false)
    setPolicyError(null)
    setServerError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPolicyError(null)
    setServerError(null)

    const policy = validatePassword(newPassword)
    if (!policy.ok) {
      setPolicyError(policy.reason)
      return
    }

    setSaving(true)
    const response = await fetch('/api/v1/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    setSaving(false)

    if (!response.ok) {
      const problem = (await response.json().catch(() => ({}))) as {
        detail?: string
        title?: string
      }
      setServerError(problem.detail ?? problem.title ?? 'Password change failed')
      return
    }

    reset()
    setOpen(false)
    setSuccess(true)
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Password</p>
          <p className="mt-0.5 text-xs text-foreground/55">
            Update the password you use to sign in.
          </p>
          {success ? (
            <p className="mt-2 text-xs font-medium text-emerald-700" role="status">
              Password updated.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setSuccess(false)
            setOpen(true)
          }}
          className="text-xs font-semibold text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Change password
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="current-password" className="text-sm font-semibold">
            Current password
          </label>
          <button
            type="button"
            onClick={() => setRevealCurrent((v) => !v)}
            className="text-xs font-medium text-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            {revealCurrent ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          id="current-password"
          type={revealCurrent ? 'text' : 'password'}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="block h-10 w-full rounded-md border border-foreground/20 bg-background px-3 text-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="new-password" className="text-sm font-semibold">
            New password
          </label>
          <button
            type="button"
            onClick={() => setRevealNew((v) => !v)}
            className="text-xs font-medium text-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            {revealNew ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          id="new-password"
          type={revealNew ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          aria-describedby="new-password-hint"
          required
          className="block h-10 w-full rounded-md border border-foreground/20 bg-background px-3 text-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
        />
        <p id="new-password-hint" className="text-xs text-foreground/55">
          {PASSWORD_HINT}
        </p>
        {policyError ? (
          <p className="text-xs font-medium text-red-600" role="alert">
            {policyError}
          </p>
        ) : null}
      </div>
      {serverError ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700"
        >
          {serverError}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Updating...' : 'Update password'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset()
            setOpen(false)
          }}
          disabled={saving}
          className="inline-flex h-9 items-center rounded-md border border-foreground/20 px-3 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function SignOutRow() {
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setSigning(true)
    setError(null)
    const response = await fetch('/api/v1/auth/signout', { method: 'POST' })
    if (!response.ok) {
      setSigning(false)
      setError('Sign out failed. Try again.')
      return
    }
    window.location.assign('/')
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Sign out</p>
        <p className="mt-0.5 text-xs text-foreground/55">
          End this session and return to the landing page.
        </p>
        {error ? (
          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={signing}
        className="inline-flex h-9 items-center rounded-md border border-red-300 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        {signing ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  )
}

async function readProblem(response: Response): Promise<{ ok: false; message: string }> {
  const problem = (await response
    .json()
    .catch(() => ({}))) as { detail?: string; title?: string }
  return { ok: false, message: problem.detail ?? problem.title ?? 'Save failed' }
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  )
}
