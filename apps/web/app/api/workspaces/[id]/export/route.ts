import { type NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonError,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { loadMenuExport } from '@/lib/api/menu-export-loader'
import { renderMenuExportMarkdown } from '@/lib/api/menu-export'

type RouteParams = { id: string }

const SUPPORTED_FORMATS = new Set(['markdown'])

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!role) return forbidden()

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'markdown'
  const weekStartDate = searchParams.get('week_start_date') ?? undefined

  if (!SUPPORTED_FORMATS.has(format)) {
    return badRequest(`format must be one of: ${Array.from(SUPPORTED_FORMATS).join(', ')}`)
  }

  return runWithErrorHandler(async () => {
    const loaded = await loadMenuExport({
      supabase: user.supabase,
      workspaceId,
      weekStartDate,
    })
    if (!loaded.ok) {
      if (loaded.reason === 'workspace_not_found') return notFound()
      if (loaded.reason === 'no_active_menu') {
        return jsonError(
          412,
          'no_active_menu',
          'No menu has been generated for this workspace yet.',
        )
      }
      return serverError(loaded.detail ?? 'failed to load export')
    }

    const body = renderMenuExportMarkdown(loaded.export)
    const fileName = `menu-${loaded.export.menu.weekStartDate}.md`
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
      },
    })
  })
}
