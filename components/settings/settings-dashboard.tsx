import Link from 'next/link'
import type { SettingsSummary } from '@/lib/shared/settings'

export function SettingsDashboard({ summary }: { summary: SettingsSummary }) {
  return (
    <div className="space-y-6">
      <header className="border-b border-foreground/10 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Account, workspace, and conversion controls for this PRIZM workspace.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <SettingsPanel title="Account">
          <SettingsGrid>
            <SettingsRow label="Email" value={summary.account.email} />
            <SettingsRow label="Name" value={summary.account.fullName ?? 'Not set'} />
            <SettingsRow label="Workspace role" value={roleLabel(summary.account.role)} />
          </SettingsGrid>
        </SettingsPanel>

        <SettingsPanel title="Workspace">
          <SettingsGrid>
            <SettingsRow label="Name" value={summary.workspace.name} />
            <SettingsRow label="Region" value={summary.workspace.defaultRegion} />
            <SettingsRow label="Members" value={memberCountLabel(summary.workspace.memberCount)} />
            <SettingsRow label="Created" value={formatDate(summary.workspace.createdAt)} />
          </SettingsGrid>
        </SettingsPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <SettingsPanel title="Conversion controls">
          <SettingsGrid>
            <SettingsRow
              label="Retention"
              value={`${summary.controls.retentionHours}-hour auto-delete`}
            />
            <SettingsRow
              label="Upload limit"
              value={`${summary.controls.maxPdfSizeMb} MB PDF limit`}
            />
            <SettingsRow label="Exports" value={summary.controls.exportFormats.join(', ')} />
          </SettingsGrid>
        </SettingsPanel>

        <aside className="rounded-lg border border-foreground/10 p-4">
          <h2 className="text-base font-semibold">Support and trust</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/60">
            Security reports and data handling commitments stay tied to public trust routes.
          </p>
          <div className="mt-4 grid gap-2 text-sm">
            <a
              className="font-medium text-[var(--accent)] hover:underline"
              href={`mailto:${summary.controls.securityEmail}`}
            >
              {summary.controls.securityEmail}
            </a>
            <Link
              className="font-medium text-[var(--accent)] hover:underline"
              href="/security/policy"
            >
              Security policy
            </Link>
            <Link className="font-medium text-[var(--accent)] hover:underline" href="/privacy">
              Privacy workflow
            </Link>
          </div>
        </aside>
      </section>
    </div>
  )
}

function SettingsPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-foreground/10 p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SettingsGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">{children}</dl>
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  )
}

function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'member') return 'Member'
  if (role === 'viewer') return 'Viewer'
  return role
}

function memberCountLabel(count: number): string {
  return `${count} member${count === 1 ? '' : 's'}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}
