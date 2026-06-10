import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccentColor, AgeCategory, WorkspaceRole } from '../types/db.js'
import type { MealFrequencyEntry } from './workspaces.js'

export type MemberRecord = {
  id: string
  user_id: string | null
  name: string
  role: WorkspaceRole
  age_category: AgeCategory
  accent_color: AccentColor | null
  daily_calorie_target: number | null
  meal_frequency: MealFrequencyEntry[] | null
  member_dietary_restrictions: Array<{ restriction: string }>
  member_allergies: Array<{ allergy: string }>
  member_ingredient_dislikes: Array<{ ingredient_id: string }>
}

export type CreateMemberPayload = {
  name: string
  role: WorkspaceRole
  age_category: AgeCategory
  accent_color?: AccentColor | null
  daily_calorie_target?: number | null
  meal_frequency?: MealFrequencyEntry[] | null
  user_id?: string | null
  dietary_restrictions?: string[]
  allergies?: string[]
  ingredient_dislikes?: string[]
}

export type UpdateMemberPatch = Partial<{
  name: string
  role: WorkspaceRole
  age_category: AgeCategory
  accent_color: AccentColor | null
  daily_calorie_target: number | null
  meal_frequency: MealFrequencyEntry[] | null
}>

export const memberQueryKeys = {
  list: (workspaceId: string) => ['members', 'list', workspaceId] as const,
  detail: (workspaceId: string, memberId: string) =>
    ['members', 'detail', workspaceId, memberId] as const,
}

export const memberKeys = {
  list: (workspaceId: string) => ['members', 'list', workspaceId] as const,
  detail: (workspaceId: string, memberId: string) =>
    ['members', 'detail', workspaceId, memberId] as const,
}

const MEMBER_SELECT = `id, user_id, name, role, age_category, accent_color, daily_calorie_target, meal_frequency,
  member_dietary_restrictions (restriction),
  member_allergies (allergy),
  member_ingredient_dislikes (ingredient_id)`

export const listMembers = async ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<MemberRecord[]> => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(MEMBER_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as MemberRecord[]
}

export const getMember = async ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): Promise<MemberRecord | null> => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(MEMBER_SELECT)
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MemberRecord | null) ?? null
}

export const createMember = async ({
  supabase,
  workspaceId,
  payload,
}: {
  supabase: SupabaseClient
  workspaceId: string
  payload: CreateMemberPayload
}): Promise<{ id: string }> => {
  const { data: row, error: insertErr } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: payload.user_id ?? null,
      name: payload.name,
      role: payload.role,
      age_category: payload.age_category,
      accent_color: payload.accent_color ?? null,
      daily_calorie_target: payload.daily_calorie_target ?? null,
      meal_frequency: payload.meal_frequency ?? null,
    })
    .select('id')
    .single()
  if (insertErr || !row) {
    throw new Error(insertErr?.message ?? 'failed to create member')
  }
  const memberId = (row as { id: string }).id
  if (payload.dietary_restrictions && payload.dietary_restrictions.length > 0) {
    await setMemberDietaryRestrictions({
      supabase,
      memberId,
      values: payload.dietary_restrictions,
    })
  }
  if (payload.allergies && payload.allergies.length > 0) {
    await setMemberAllergies({ supabase, memberId, values: payload.allergies })
  }
  if (payload.ingredient_dislikes && payload.ingredient_dislikes.length > 0) {
    await setMemberIngredientDislikes({
      supabase,
      memberId,
      ingredientIds: payload.ingredient_dislikes,
    })
  }
  return { id: memberId }
}

export const updateMember = async ({
  supabase,
  workspaceId,
  memberId,
  patch,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
  patch: UpdateMemberPatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  const { error } = await supabase
    .from('workspace_members')
    .update(patch)
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

export const softDeleteMember = async ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): Promise<void> => {
  const { error } = await supabase
    .from('workspace_members')
    .update({ is_deleted: true })
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

export const setMemberDietaryRestrictions = async ({
  supabase,
  memberId,
  values,
}: {
  supabase: SupabaseClient
  memberId: string
  values: string[]
}): Promise<void> => {
  // Funnel each label through sys_save_label so user-typed values land in
  // enum_metadata. Matches replaceRecipeDietaryTags in recipes.ts.
  for (const value of values) {
    await supabase.rpc('sys_save_label', {
      p_enum_type: 'dietary_restriction',
      p_value: value,
    })
  }
  const { error: delErr } = await supabase
    .from('member_dietary_restrictions')
    .delete()
    .eq('member_id', memberId)
  if (delErr) throw new Error(delErr.message)
  if (values.length === 0) return
  const { error: insErr } = await supabase
    .from('member_dietary_restrictions')
    .insert(values.map((restriction) => ({ member_id: memberId, restriction })))
  if (insErr) throw new Error(insErr.message)
}

export const setMemberAllergies = async ({
  supabase,
  memberId,
  values,
}: {
  supabase: SupabaseClient
  memberId: string
  values: string[]
}): Promise<void> => {
  for (const value of values) {
    await supabase.rpc('sys_save_label', {
      p_enum_type: 'food_allergy',
      p_value: value,
    })
  }
  const { error: delErr } = await supabase
    .from('member_allergies')
    .delete()
    .eq('member_id', memberId)
  if (delErr) throw new Error(delErr.message)
  if (values.length === 0) return
  const { error: insErr } = await supabase
    .from('member_allergies')
    .insert(values.map((allergy) => ({ member_id: memberId, allergy })))
  if (insErr) throw new Error(insErr.message)
}

export const setMemberIngredientDislikes = async ({
  supabase,
  memberId,
  ingredientIds,
}: {
  supabase: SupabaseClient
  memberId: string
  ingredientIds: string[]
}): Promise<void> => {
  const { error: delErr } = await supabase
    .from('member_ingredient_dislikes')
    .delete()
    .eq('member_id', memberId)
  if (delErr) throw new Error(delErr.message)
  if (ingredientIds.length === 0) return
  const { error: insErr } = await supabase
    .from('member_ingredient_dislikes')
    .insert(ingredientIds.map((ingredient_id) => ({ member_id: memberId, ingredient_id })))
  if (insErr) throw new Error(insErr.message)
}
