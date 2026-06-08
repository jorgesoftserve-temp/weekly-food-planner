import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { httpRequest } from '../http-client.js'
import { workspaceRecipeUsabilityInputShape } from '../schemas.js'
import { textResult, type ToolCallResult } from './shared.js'

// workspace.recipe_usability — calls GET /recipes/:recipeId/usability with
// the member id (and optional meal type) in the query string. Wraps the
// engine's `describeRecipeEligibility` server-side so the answer matches
// exactly what the menu generator would see.

export type WorkspaceRecipeUsabilityArgs = {
  workspaceId: string
  recipeId: string
  memberId: string
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
}

export const workspaceRecipeUsabilityHandler = async ({
  workspaceId,
  recipeId,
  memberId,
  mealType,
}: WorkspaceRecipeUsabilityArgs): Promise<ToolCallResult> => {
  const result = await httpRequest<unknown>({
    method: 'GET',
    path: `/api/workspaces/${workspaceId}/recipes/${recipeId}/usability`,
    query: {
      memberId,
      mealType,
    },
  })
  return textResult(result)
}

export const registerWorkspaceRecipeUsability = (
  server: McpServer,
): void => {
  server.registerTool(
    'workspace_recipe_usability',
    {
      description:
        'Answers "can member M eat recipe R, and if not, why" against an existing workspace. Returns { eligible, blockedBy[] } where blockedBy is the engine\'s structured EligibilityBlocker[] (meal_type_mismatch, missing_dietary_tag, excluded_ingredient, allergen_present). Pass mealType to also check meal-type fit. Requires MENU_MCP_USER_JWT.',
      inputSchema: workspaceRecipeUsabilityInputShape,
    },
    workspaceRecipeUsabilityHandler,
  )
}
