import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { httpRequest } from '../http-client.js'
import { workspaceRecentMenusInputShape } from '../schemas.js'
import { textResult, type ToolCallResult } from './shared.js'

// workspace.recent_menus — calls GET /menus/history. Returns the most recent
// accepted menus in reverse-chronological order. Useful for "what did this
// workspace eat last week" inspection and for "is this menu a near-repeat of
// the prior one" before regenerating.

export type WorkspaceRecentMenusArgs = {
  workspaceId: string
  limit?: number
}

export const workspaceRecentMenusHandler = async ({
  workspaceId,
  limit,
}: WorkspaceRecentMenusArgs): Promise<ToolCallResult> => {
  const result = await httpRequest<unknown>({
    method: 'GET',
    path: `/api/workspaces/${workspaceId}/menus/history`,
    query: {
      limit: limit === undefined ? undefined : String(limit),
    },
  })
  return textResult(result)
}

export const registerWorkspaceRecentMenus = (server: McpServer): void => {
  server.registerTool(
    'workspace_recent_menus',
    {
      description:
        'Returns up to `limit` (default 26, max 100) accepted menus for a workspace in reverse-chronological order. Each entry includes week start date, engine seed, accepted seed, and whether the user modified slots before acceptance. Use to look up history before regenerating. Requires MENU_MCP_USER_JWT.',
      inputSchema: workspaceRecentMenusInputShape,
    },
    workspaceRecentMenusHandler,
  )
}
