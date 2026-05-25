import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  labelKeys,
  saveLabel,
  searchLabels,
  type LabelMatch,
} from './labels.js'

export const useLabelSearch = ({
  supabase,
  enumType,
  query,
  limit,
  enabled = true,
}: {
  supabase: SupabaseClient
  enumType: string
  query: string
  limit?: number
  enabled?: boolean
}): UseQueryResult<LabelMatch[]> =>
  useQuery({
    queryKey: labelKeys.search(enumType, query),
    queryFn: () => searchLabels({ supabase, enumType, query, limit }),
    enabled,
    staleTime: 30 * 1000,
  })

export const useSaveLabel = ({
  supabase,
}: {
  supabase: SupabaseClient
}): UseMutationResult<void, Error, { enumType: string; value: string }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ enumType, value }) =>
      saveLabel({ supabase, enumType, value }),
    onSuccess: (_data, { enumType }) => {
      void queryClient.invalidateQueries({
        queryKey: ['labels', 'search', enumType],
      })
    },
  })
}
