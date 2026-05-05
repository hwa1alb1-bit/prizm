import 'server-only'

import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { publicEnv } from '../shared/env'
import type { Database } from '../shared/db-types'
import type { ProblemInit } from './http'

export type AuthenticatedUserContext = {
  supabase: SupabaseClient<Database>
  user: User
}

export type AuthorizedUserContext = AuthenticatedUserContext & {
  profile: {
    workspace_id: string
    role: string
  }
}

type AuthResult<T> = { ok: true; context: T } | { ok: false; problem: ProblemInit }

export async function requireAuthenticatedUser(): Promise<AuthResult<AuthenticatedUserContext>> {
  const clientResult = await createCookieServerClient()
  if (!clientResult.ok) return clientResult

  const {
    data: { user },
    error,
  } = await clientResult.context.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      problem: {
        status: 401,
        code: 'PRZM_AUTH_UNAUTHORIZED',
        title: 'Authentication required',
        detail: 'Sign in before calling this route.',
      },
    }
  }

  return { ok: true, context: { supabase: clientResult.context, user } }
}

export async function requireOwnerOrAdminUser(): Promise<AuthResult<AuthorizedUserContext>> {
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) return auth

  const { data: profile, error } = await auth.context.supabase
    .from('user_profile')
    .select('workspace_id, role')
    .eq('id', auth.context.user.id)
    .single()

  if (error || !profile) {
    return {
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_WORKSPACE_REQUIRED',
        title: 'Workspace access required',
        detail: 'The signed-in user is not attached to a workspace.',
      },
    }
  }

  if (profile.role !== 'owner' && profile.role !== 'admin') {
    return {
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_FORBIDDEN',
        title: 'Forbidden',
        detail: 'Owner or admin access is required for this route.',
      },
    }
  }

  return {
    ok: true,
    context: {
      ...auth.context,
      profile,
    },
  }
}

async function createCookieServerClient(): Promise<AuthResult<SupabaseClient<Database>>> {
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      problem: {
        status: 500,
        code: 'PRZM_INTERNAL_AUTH_CONFIG',
        title: 'Authentication is not configured',
        detail: 'Supabase public configuration is missing.',
      },
    }
  }

  const cookieStore = await cookies()

  return {
    ok: true,
    context: createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component callers cannot mutate cookies. Route handlers can.
          }
        },
      },
    }),
  }
}
