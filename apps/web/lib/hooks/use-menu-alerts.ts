'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ShoppingAlertsResult } from '@/lib/api/menu-alerts'

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    return body.detail ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

export const menuAlertsKeys = {
  forMenu: (workspaceId: string, menuId: string) =>
    ['menu-alerts', workspaceId, menuId] as const,
}

// (v2.0 Phase 3) Reads the derived incomplete-shopping alerts for an accepted
// menu. Returns one entry per not-yet-cooked slot that needs an unacquired
// ingredient the pantry can't cover. Purely read-side; no mutation pairs with it.
export const useMenuShoppingAlerts = ({
  workspaceId,
  menuId,
  enabled = true,
}: {
  workspaceId: string | null
  menuId: string | null
  enabled?: boolean
}): UseQueryResult<ShoppingAlertsResult, Error> =>
  useQuery({
    queryKey: menuAlertsKeys.forMenu(workspaceId ?? '', menuId ?? ''),
    enabled: enabled && !!workspaceId && !!menuId,
    queryFn: async () => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/alerts`,
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'could not load shopping alerts'))
      }
      const body = (await response.json()) as { result: ShoppingAlertsResult }
      return body.result
    },
  })
