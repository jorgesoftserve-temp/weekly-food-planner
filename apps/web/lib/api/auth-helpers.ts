import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseServerClient } from '@/utils/supabase/server'

export { getWorkspaceRole, hasAdminRole } from '@weekly-food-planner/supabase'

export type AuthenticatedUser = {
  id: string
  email: string | null
  supabase: SupabaseClient
}

export const getAuthenticatedUser = async (): Promise<AuthenticatedUser | null> => {
  const supabase = await supabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    supabase,
  }
}
