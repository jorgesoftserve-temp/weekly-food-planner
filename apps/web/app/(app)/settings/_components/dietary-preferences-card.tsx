'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { listMembers, memberKeys } from '@weekly-food-planner/supabase'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useAuthUser } from '@/lib/hooks/use-auth-user'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MultiLabelCombobox } from '@/components/forms/multi-label-combobox'
import { notifyError, notifySuccess } from '@/lib/toast'

// PUT helper — same call pattern the verify-flow.mjs driver uses. Both
// endpoints accept { values: string[] } and run each value through
// sys_save_label server-side so newly-typed entries persist to enum_metadata.
const putValues = async ({
  workspaceId,
  memberId,
  field,
  values,
}: {
  workspaceId: string
  memberId: string
  field: 'dietary-restrictions' | 'allergies'
  values: string[]
}): Promise<void> => {
  const res = await fetch(
    `/api/workspaces/${workspaceId}/members/${memberId}/${field}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `Failed to update ${field}`)
  }
}

export const DietaryPreferencesCard = () => {
  const supabase = useSupabase()
  const { data: user } = useAuthUser()
  const { workspace } = useActiveWorkspace()

  // The workspace-with-members shape doesn't carry user_id or the
  // dietary/allergy joins, so fetch the full member list separately and
  // resolve the creator member by user_id match.
  const membersQuery = useQuery({
    queryKey: workspace ? memberKeys.list(workspace.id) : ['members', 'list', 'null'],
    queryFn: () => listMembers({ supabase, workspaceId: workspace!.id }),
    enabled: !!workspace,
  })

  const creatorMember = useMemo(() => {
    if (!user) return null
    const list = membersQuery.data ?? []
    return list.find((m) => m.user_id === user.id) ?? list[0] ?? null
  }, [membersQuery.data, user])

  const [restrictions, setRestrictions] = useState<string[]>([])
  const [allergies, setAllergies] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Seed once when the member lands. Subsequent edits stay local until Save —
  // mirrors how Profile + Password forms behave on this page.
  useEffect(() => {
    if (creatorMember) {
      setRestrictions(creatorMember.member_dietary_restrictions.map((r) => r.restriction))
      setAllergies(creatorMember.member_allergies.map((a) => a.allergy))
    }
  }, [creatorMember])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workspace || !creatorMember) return
    setSaving(true)
    try {
      // Two parallel PUTs — neither depends on the other and both touch the
      // same member row, so we eat the second roundtrip cost rather than
      // serializing.
      await Promise.all([
        putValues({
          workspaceId: workspace.id,
          memberId: creatorMember.id,
          field: 'dietary-restrictions',
          values: restrictions,
        }),
        putValues({
          workspaceId: workspace.id,
          memberId: creatorMember.id,
          field: 'allergies',
          values: allergies,
        }),
      ])
      notifySuccess('Dietary preferences saved', 'Future menu generations will respect these.')
      void membersQuery.refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save preferences.'
      notifyError('Save failed', message)
    } finally {
      setSaving(false)
    }
  }

  const isLoading = membersQuery.isLoading || !workspace
  const noMember = !isLoading && !creatorMember

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dietary preferences</CardTitle>
        <CardDescription>
          Hard constraints applied to every menu generation. Allergies exclude any recipe whose
          ingredients carry the allergen; restrictions exclude recipes lacking the matching
          dietary tag.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {noMember ? (
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find your member record in this workspace.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Dietary restrictions</Label>
              <MultiLabelCombobox
                enumType="dietary_restriction"
                value={restrictions}
                onChange={setRestrictions}
                placeholder="e.g. vegetarian, gluten_free"
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Allergies</Label>
              <MultiLabelCombobox
                enumType="food_allergy"
                value={allergies}
                onChange={setAllergies}
                placeholder="e.g. peanut, shellfish"
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || isLoading}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save preferences'
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
