import type { SupabaseClient } from '@supabase/supabase-js'

export const getWorkspaceRole = async ({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
}): Promise<string | null> => {
  const { data, error } = await supabase.rpc('fn_user_workspace_role', {
    p_user_id: userId,
    p_workspace_id: workspaceId,
  })
  if (error) return null
  return (data as string | null) ?? null
}

export const hasAdminRole = (role: string | null): boolean => {
  return role === 'creator' || role === 'admin'
}
