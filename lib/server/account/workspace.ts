import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/db-types'

export type UpdateWorkspaceNameInput = {
  supabase: SupabaseClient<Database>
  workspaceId: string
  name: string
}

export type UpdateWorkspaceNameResult = { ok: true } | { ok: false; reason: string }

export async function updateWorkspaceName({
  supabase,
  workspaceId,
  name,
}: UpdateWorkspaceNameInput): Promise<UpdateWorkspaceNameResult> {
  const { error } = await supabase.from('workspace').update({ name }).eq('id', workspaceId)

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
