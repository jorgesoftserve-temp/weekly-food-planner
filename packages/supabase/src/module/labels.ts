import type { SupabaseClient } from '@supabase/supabase-js'

export type LabelMatch = {
  enum_type: string
  value: string
  display_name: string | null
  description: string | null
  is_official: boolean
  is_pending: boolean
  usage_count: number
}

export const labelQueryKeys = {
  search: (enumType: string, query: string) =>
    ['labels', 'search', enumType, query] as const,
}

export const labelKeys = {
  search: (enumType: string, query: string) =>
    ['labels', 'search', enumType, query] as const,
}

const LABEL_SELECT =
  'enum_type, value, display_name, description, is_official, is_pending, usage_count'

export const searchLabels = async ({
  supabase,
  enumType,
  query,
  limit = 20,
}: {
  supabase: SupabaseClient
  enumType: string
  query: string
  limit?: number
}): Promise<LabelMatch[]> => {
  let builder = supabase
    .from('enum_metadata')
    .select(LABEL_SELECT)
    .eq('enum_type', enumType)
    .order('usage_count', { ascending: false })
    .limit(limit)
  const trimmed = query.trim()
  if (trimmed.length > 0) {
    builder = builder.ilike('value', `%${trimmed}%`)
  }
  const { data, error } = await builder
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LabelMatch[]
}

export const saveLabel = async ({
  supabase,
  enumType,
  value,
}: {
  supabase: SupabaseClient
  enumType: string
  value: string
}): Promise<void> => {
  const { error } = await supabase.rpc('sys_save_label', {
    p_enum_type: enumType,
    p_value: value,
  })
  if (error) throw new Error(error.message)
}

export const deleteEnumSuggestion = async ({
  supabase,
  enumType,
  value,
}: {
  supabase: SupabaseClient
  enumType: string
  value: string
}): Promise<void> => {
  const { error } = await supabase.rpc('sys_delete_enum_suggestion', {
    p_enum_type: enumType,
    p_value: value,
  })
  if (error) throw new Error(error.message)
}
