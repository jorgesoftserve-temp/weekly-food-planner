import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { httpRequest } from '../http-client.js'
import { workspacePreviewMenuInputShape } from '../schemas.js'
import { textResult, type ToolCallResult } from './shared.js'

// workspace.preview_menu — calls POST /menus/preview on the running Next.js
// app. Same auth gate + overlay dedup + participant filtering as the
// persisting POST /menus weekly path, but WITHOUT writing any rows. The
// drift-detector test in apps/web/integration/menu-preview-drift.integration
// .test.ts asserts both produce identical inputsHash for the same body.

export type WorkspacePreviewMenuArgs = {
  workspaceId: string
  weekStartDate: string
  seed?: number
  durationDays?: number
  options?: Record<string, unknown>
  participantMemberIds?: string[]
}

export const workspacePreviewMenuHandler = async ({
  workspaceId,
  weekStartDate,
  seed,
  durationDays,
  options,
  participantMemberIds,
}: WorkspacePreviewMenuArgs): Promise<ToolCallResult> => {
  const body: Record<string, unknown> = { weekStartDate }
  if (seed !== undefined) body.seed = seed
  if (durationDays !== undefined) body.durationDays = durationDays
  if (options !== undefined) body.options = options
  if (participantMemberIds !== undefined) {
    body.participantMemberIds = participantMemberIds
  }
  const result = await httpRequest<unknown>({
    method: 'POST',
    path: `/api/workspaces/${workspaceId}/menus/preview`,
    body,
  })
  return textResult(result)
}

export const registerWorkspacePreviewMenu = (server: McpServer): void => {
  server.registerTool(
    'workspace_preview_menu',
    {
      description:
        'Generates a menu for an existing workspace without persisting any rows — same engine path as POST /menus weekly, but the result is returned only. Use for what-if loops, constraint experiments, and overlay tuning. Requires MENU_MCP_USER_JWT. Returns { ok, mode:"preview", inputsHash, seed, durationDays, effectiveOverlay, participantMemberIds, menu, groceryLists }.',
      inputSchema: workspacePreviewMenuInputShape,
    },
    workspacePreviewMenuHandler,
  )
}
