#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { isHttpConfigured } from './http-client.js'
import { registerEngineGenerateMenu } from './tools/engine-generate-menu.js'
import { registerEngineComputeInputsHash } from './tools/engine-compute-inputs-hash.js'
import { registerEngineValidateInput } from './tools/engine-validate-input.js'
import { registerWorkspacePreviewMenu } from './tools/workspace-preview-menu.js'
import { registerWorkspaceMemberConstraints } from './tools/workspace-member-constraints.js'
import { registerWorkspaceRecipeUsability } from './tools/workspace-recipe-usability.js'
import { registerWorkspaceRecentMenus } from './tools/workspace-recent-menus.js'
import { textResult } from './tools/shared.js'

// Menu MCP server — engine + workspace halves both live (steps 5 + 6).
//
// Tool surface:
//   ping                            — liveness + workspace.* configured flag
//   engine_generate_menu            — pure engine wrapper
//   engine_compute_inputs_hash      — canonical input hash
//   engine_validate_input           — pre-flight check for input shape + slots
//   workspace_preview_menu          — POST /menus/preview, no persist
//   workspace_member_constraints    — GET /members/:id/constraints (joined)
//   workspace_recipe_usability      — GET /recipes/:id/usability
//   workspace_recent_menus          — GET /menus/history
//
// workspace_* tools require MENU_MCP_USER_JWT; engine_* tools do not.
// assert_constraint is deferred — the agent can inspect engine results
// directly and the bridge-tool design (menuId vs inline) needs real usage
// data before committing.

const server = new McpServer({
  name: 'menu',
  version: '0.1.0',
})

// Liveness — also reports whether workspace.* tools will work in this
// session. Cheaper than asking the agent to remember whether the JWT is set.
server.registerTool(
  'ping',
  {
    description:
      'Liveness check. Returns { ok, pong: true, workspaceToolsConfigured } so /mcp can confirm the server boots and the agent can see whether MENU_MCP_USER_JWT is set for workspace.* calls.',
  },
  async () =>
    textResult({
      ok: true,
      pong: true,
      workspaceToolsConfigured: isHttpConfigured(),
    }),
)

registerEngineGenerateMenu(server)
registerEngineComputeInputsHash(server)
registerEngineValidateInput(server)
registerWorkspacePreviewMenu(server)
registerWorkspaceMemberConstraints(server)
registerWorkspaceRecipeUsability(server)
registerWorkspaceRecentMenus(server)

const transport = new StdioServerTransport()
await server.connect(transport)
