import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { httpRequest } from '../http-client.js'
import { workspaceMemberConstraintsInputShape } from '../schemas.js'
import { textResult, type ToolCallResult } from './shared.js'

// workspace.member_constraints — calls GET /members/:memberId/constraints
// which joins member profile + dietary restrictions + allergies + ingredient
// dislikes + meal-frequency cascade source into one response. Same data the
// engine sees, so the agent's view matches what the menu generator would
// actually filter against.

export type WorkspaceMemberConstraintsArgs = {
  workspaceId: string
  memberId: string
}

export const workspaceMemberConstraintsHandler = async ({
  workspaceId,
  memberId,
}: WorkspaceMemberConstraintsArgs): Promise<ToolCallResult> => {
  const result = await httpRequest<unknown>({
    method: 'GET',
    path: `/api/workspaces/${workspaceId}/members/${memberId}/constraints`,
  })
  return textResult(result)
}

export const registerWorkspaceMemberConstraints = (
  server: McpServer,
): void => {
  server.registerTool(
    'workspace_member_constraints',
    {
      description:
        'Returns the full constraint picture for one member of a workspace — profile, mealFrequency (cascade-resolved with source), dietaryRestrictions[], allergies[], ingredientDislikes[]. Same join the engine sees. Requires MENU_MCP_USER_JWT.',
      inputSchema: workspaceMemberConstraintsInputShape,
    },
    workspaceMemberConstraintsHandler,
  )
}
