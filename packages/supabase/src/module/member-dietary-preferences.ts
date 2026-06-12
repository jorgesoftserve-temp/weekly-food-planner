import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateMemberDietaryPreferencePayload,
  MemberDietaryPreferenceRow,
  PreferenceKind,
} from '../types/db.js'

// (v2.1 Track C) Inclusive (soft-bias) dietary preferences for a member.
// Direct DELETE semantics — no soft delete (junction-style, mirroring
// member_dietary_restrictions / member_allergies). RLS via workspace_id.
// DATABASE_PRD §6.22.

export type MemberDietaryPreferenceRecord = MemberDietaryPreferenceRow

export const memberDietaryPreferenceQueryKeys = {
  forMember: (workspaceId: string, memberId: string) =>
    ['member-dietary-preferences', 'member', workspaceId, memberId] as const,
}

export const memberDietaryPreferenceKeys = {
  forMember: (workspaceId: string, memberId: string) =>
    ['member-dietary-preferences', 'member', workspaceId, memberId] as const,
}

const PREFERENCE_SELECT = 'id, member_id, workspace_id, kind, value, created_at'

export const getMemberDietaryPreferences = async ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): Promise<MemberDietaryPreferenceRecord[]> => {
  const { data, error } = await supabase
    .from('member_dietary_preferences')
    .select(PREFERENCE_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as MemberDietaryPreferenceRecord[]
}

export const addMemberDietaryPreference = async ({
  supabase,
  payload,
}: {
  supabase: SupabaseClient
  payload: CreateMemberDietaryPreferencePayload
}): Promise<MemberDietaryPreferenceRecord> => {
  const { data, error } = await supabase
    .from('member_dietary_preferences')
    .insert({
      member_id: payload.member_id,
      workspace_id: payload.workspace_id,
      kind: payload.kind,
      value: payload.value,
    })
    .select(PREFERENCE_SELECT)
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'failed to add dietary preference')
  }
  return data as unknown as MemberDietaryPreferenceRecord
}

export const removeMemberDietaryPreference = async ({
  supabase,
  preferenceId,
}: {
  supabase: SupabaseClient
  preferenceId: string
}): Promise<void> => {
  const { error } = await supabase
    .from('member_dietary_preferences')
    .delete()
    .eq('id', preferenceId)
  if (error) throw new Error(error.message)
}

/**
 * Replace the full set of preferences of a given kind for a member.
 * Mirrors setMemberDietaryRestrictions in members.ts — delete all for the kind
 * then insert the new values. Funnels dietary_tag values through sys_save_label
 * so user-typed labels land in enum_metadata.
 */
export const setMemberDietaryPreferences = async ({
  supabase,
  workspaceId,
  memberId,
  kind,
  values,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
  kind: PreferenceKind
  values: string[]
}): Promise<void> => {
  if (kind === 'dietary_tag') {
    for (const value of values) {
      await supabase.rpc('sys_save_label', {
        p_enum_type: 'dietary_tag',
        p_value: value,
      })
    }
  }
  const { error: delErr } = await supabase
    .from('member_dietary_preferences')
    .delete()
    .eq('member_id', memberId)
    .eq('workspace_id', workspaceId)
    .eq('kind', kind)
  if (delErr) throw new Error(delErr.message)
  if (values.length === 0) return
  const { error: insErr } = await supabase.from('member_dietary_preferences').insert(
    values.map((value) => ({
      member_id: memberId,
      workspace_id: workspaceId,
      kind,
      value,
    })),
  )
  if (insErr) throw new Error(insErr.message)
}
