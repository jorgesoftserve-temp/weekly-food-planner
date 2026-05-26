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
import {
  renderMenuExportCsv,
  renderMenuExportMarkdown,
} from '@/lib/api/menu-export'

type RouteParams = { id: string }

type ExportFormat = 'markdown' | 'csv'

const FORMAT_CONFIG: Record<ExportFormat, { contentType: string; extension: string }> = {
  markdown: { contentType: 'text/markdown; charset=utf-8', extension: 'md' },
  csv: { contentType: 'text/csv; charset=utf-8', extension: 'csv' },
}

const SUPPORTED_FORMATS = new Set<ExportFormat>(['markdown', 'csv'])

const isSupportedFormat = (value: string): value is ExportFormat =>
  (SUPPORTED_FORMATS as Set<string>).has(value)

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
  const formatParam = searchParams.get('format') ?? 'markdown'
  const weekStartDate = searchParams.get('week_start_date') ?? undefined
  // shop_for is a comma-separated list of member ids, matching the same URL
  // convention the grocery page uses for its in-app filter (PRODUCT_PRD §7.1).
  // Empty / missing = whole household, no filtering.
  const shopForRaw = searchParams.get('shop_for')
  const shopForIds = shopForRaw
    ? shopForRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : null

  if (!isSupportedFormat(formatParam)) {
    return badRequest(`format must be one of: ${Array.from(SUPPORTED_FORMATS).join(', ')}`)
  }
  const format: ExportFormat = formatParam

  return runWithErrorHandler(async () => {
    const loaded = await loadMenuExport({
      supabase: user.supabase,
      workspaceId,
      weekStartDate,
      shopForIds,
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

    const body =
      format === 'csv'
        ? renderMenuExportCsv(loaded.export)
        : renderMenuExportMarkdown(loaded.export)
    const { contentType, extension } = FORMAT_CONFIG[format]
    const fileName = `menu-${loaded.export.menu.weekStartDate}.${extension}`
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-disposition': `attachment; filename="${fileName}"`,
      },
    })
  })
}
