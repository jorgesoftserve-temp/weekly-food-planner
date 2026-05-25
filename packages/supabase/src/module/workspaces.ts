import type { SupabaseClient } from '@supabase/supabase-js'
import type { MealType, WorkspaceMemberRow } from '../types/db.js'

export type MealFrequencyEntry = {
  key: string
  title: string
  mealType: MealType
  defaultHour: number
}

export type WorkspaceWithMembers = {
  id: string
  type: 'individual' | 'group'
  name: string
  shared_meal_frequency: MealFrequencyEntry[] | null
  workspace_members: Array<
    Pick<
      WorkspaceMemberRow,
      'id' | 'name' | 'role' | 'age_category' | 'daily_calorie_target' | 'meal_frequency'
    >
  >
}

export type WorkspaceListEntry = {
  workspace_id: string
  role: string
  workspace: {
    id: string
    type: 'individual' | 'group'
    name: string
  }
}

export type UpdateWorkspacePatch = Partial<{
  name: string
  shared_meal_frequency: MealFrequencyEntry[]
}>

export const workspaceQueryKeys = {
  detail: (workspaceId: string) => ['workspaces', 'detail', workspaceId] as const,
  listForUser: ['workspaces', 'list-for-user'] as const,
}

export const workspaceKeys = {
  detail: (workspaceId: string) => ['workspaces', 'detail', workspaceId] as const,
  listForUser: () => ['workspaces', 'list-for-user'] as const,
}

export const getWorkspaceWithMembers = async ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<WorkspaceWithMembers | null> => {
  const { data, error } = await supabase
    .from('workspaces')
    .select(
      `id, type, name, shared_meal_frequency,
       workspace_members (id, name, role, age_category, daily_calorie_target, meal_frequency)`,
    )
    .eq('id', workspaceId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as WorkspaceWithMembers | null) ?? null
}

export const updateWorkspace = async ({
  supabase,
  workspaceId,
  patch,
}: {
  supabase: SupabaseClient
  workspaceId: string
  patch: UpdateWorkspacePatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) {
    throw new Error('no fields to update')
  }
  const { error } = await supabase
    .from('workspaces')
    .update(patch)
    .eq('id', workspaceId)
  if (error) throw new Error(error.message)
}

export const listWorkspacesForUser = async ({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}): Promise<WorkspaceListEntry[]> => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspace:workspaces (id, type, name)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as WorkspaceListEntry[]
}
