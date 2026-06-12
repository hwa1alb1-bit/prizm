'use client'

import type { BillingSummary } from '@/lib/shared/billing'
import type { SettingsSummary } from '@/lib/shared/settings'

type AccountFormProps = {
  settings: SettingsSummary
  billing: BillingSummary
}

// PR4 slices C2..C7 flesh out the editable fields, sign-out, and billing
// section. C1 ships this skeleton so the route renders and the e2e specs
// can exercise the layout.
export function AccountForm({ settings, billing }: AccountFormProps) {
  return (
    <div className="space-y-6">
      <section
        aria-labelledby="account-section-heading"
        className="rounded-lg border border-foreground/10 p-5"
      >
        <h2 id="account-section-heading" className="text-base font-semibold">
          Account
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Full name" value={settings.account.fullName ?? 'Not set'} />
          <Field label="Email" value={settings.account.email} />
          <Field label="Workspace" value={settings.workspace.name} />
          <Field label="Role" value={settings.account.role} />
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
          <Field label="Plan" value={billing.plan} />
          <Field label="Status" value={billing.status} />
          <Field
            label="Credits"
            value={`${billing.usedCredits} / ${billing.monthlyCredits} used this period`}
          />
          <Field
            label="Renews"
            value={billing.currentPeriodEnd ? billing.currentPeriodEnd.slice(0, 10) : 'No renewal'}
          />
        </dl>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  )
}
