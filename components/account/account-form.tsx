'use client'

import { useState } from 'react'
import type { BillingSummary } from '@/lib/shared/billing'
import type { SettingsSummary } from '@/lib/shared/settings'

type AccountFormProps = {
  settings: SettingsSummary
  billing: BillingSummary
}

export function AccountForm({ settings, billing }: AccountFormProps) {
  const [fullName, setFullName] = useState<string>(settings.account.fullName ?? '')

  async function saveFullName(value: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const response = await fetch('/api/v1/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: value }),
    })
    if (!response.ok) {
      const problem = (await response
        .json()
        .catch(() => ({}))) as { detail?: string; title?: string }
      return { ok: false, message: problem.detail ?? problem.title ?? 'Save failed' }
    }
    const body = (await response.json().catch(() => ({}))) as { full_name?: string }
    if (body.full_name) setFullName(body.full_name)
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
          <ReadOnlyRow label="Email" value={settings.account.email} />
          <ReadOnlyRow label="Workspace" value={settings.workspace.name} />
          <ReadOnlyRow label="Role" value={settings.account.role} />
        </dl>
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

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  )
}
