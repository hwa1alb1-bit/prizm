import 'server-only'

import { getServiceRoleClient } from '@/lib/server/supabase'
import type { SettingsSummary } from '@/lib/shared/settings'

type SettingsSummaryInput = {
  userId: string
}

type SettingsProfileRow = {
  workspace_id: string
  email: string
  full_name: string | null
  role: string
}

type SettingsWorkspaceRow = {
  id: string
  name: string
  default_region: string
  created_at: string
}

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

type ListQueryResult<T> = {
  data: T[] | null
  count: number | null
  error: { message: string } | null
}

type SettingsFilter<T> = {
  eq: (column: 'id' | 'workspace_id', value: string) => SettingsFilter<T>
  single: () => Promise<QueryResult<T>>
  then: <TResult1 = ListQueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ListQueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => PromiseLike<TResult1 | TResult2>
}

type SettingsSummaryClient = {
  from: (table: 'user_profile' | 'workspace') => {
    select: <T>(columns: string, options?: { count?: 'exact'; head?: boolean }) => SettingsFilter<T>
  }
}

export async function getSettingsSummaryForUser(
  input: SettingsSummaryInput,
): Promise<SettingsSummary> {
  const client = getServiceRoleClient() as unknown as SettingsSummaryClient
  const profileResult = await client
    .from('user_profile')
    .select<SettingsProfileRow>('workspace_id, email, full_name, role')
    .eq('id', input.userId)
    .single()

  if (!profileResult?.data || profileResult.error) {
    throw new Error('settings_profile_not_found')
  }

  const profile = profileResult.data as SettingsProfileRow
  const workspaceResult = await client
    .from('workspace')
    .select<SettingsWorkspaceRow>('id, name, default_region, created_at')
    .eq('id', profile.workspace_id)
    .single()

  if (!workspaceResult?.data || workspaceResult.error) {
    throw new Error('settings_workspace_not_found')
  }

  const membersResult = await client
    .from('user_profile')
    .select<never>('*', { count: 'exact', head: true })
    .eq('workspace_id', profile.workspace_id)

  if (membersResult.error || membersResult.count === null) {
    throw new Error('settings_members_not_found')
  }

  const workspace = workspaceResult.data as SettingsWorkspaceRow

  return {
    account: {
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      defaultRegion: workspace.default_region,
      memberCount: membersResult.count,
      createdAt: workspace.created_at,
    },
    controls: {
      retentionHours: 24,
      maxPdfSizeMb: 50,
      exportFormats: ['CSV', 'XLSX'],
      securityEmail: 'security@prizmview.app',
    },
  }
}
