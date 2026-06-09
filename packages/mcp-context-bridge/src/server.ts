#!/usr/bin/env node
// Minimal MCP server exposing the five context-bridge verbs as stdio tools.
//
// Tool surface (all backed by a single in-process ProtocolSession):
//   sendContext    — register a context envelope, returns { contextRef, contextHash }
//   requestAction  — run the deterministic engine over the current context
//   receiveResult  — read back the result + verify verdict
//   confirm        — accept a green result, returns acceptedSeed
//   rollback       — discard the current draft/accept, back to the context
//
// Pure + offline: no DB, no network, no auth. Same (context, action) always
// yields the same result. Boot with `pnpm --filter
// @weekly-food-planner/mcp-context-bridge --silent start`.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { contextEnvelopeSchema } from './schema.js'
import { ProtocolError, ProtocolSession } from './session.js'
import type { ContextEnvelope } from './types.js'

type ToolCallResult = { content: Array<{ type: 'text'; text: string }> }

const textResult = (value: unknown): ToolCallResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
})

// Wrap a verb so a ProtocolError becomes a structured { error } block instead of
// crashing the tool call.
const safe = async (fn: () => unknown | Promise<unknown>): Promise<ToolCallResult> => {
  try {
    return textResult(await fn())
  } catch (err) {
    if (err instanceof ProtocolError) {
      return textResult({ error: { code: err.code, message: err.message } })
    }
    return textResult({
      error: { code: 'internal_error', message: err instanceof Error ? err.message : String(err) },
    })
  }
}

const session = new ProtocolSession()

const server = new McpServer({ name: 'mcp-context-bridge', version: '0.1.0' })

server.registerTool(
  'sendContext',
  {
    description:
      'Register a context envelope (intent + full GenerateMenuInput payload) and make it current. Returns { contextRef, contextHash, state }. contextHash is a stable content address of the canonicalised context.',
    inputSchema: { context: contextEnvelopeSchema },
  },
  async ({ context }) =>
    safe(() => session.sendContext({ context: context as unknown as ContextEnvelope })),
)

server.registerTool(
  'requestAction',
  {
    description:
      'Run an action against the current context. Only "generate_menu" is supported; it invokes the deterministic constraint engine. Optional seedOverride replaces input.seed for this call. Returns { actionRef, contextRef, state }.',
    inputSchema: {
      contextRef: z.string(),
      action: z.enum(['generate_menu']),
      seedOverride: z.number().optional(),
    },
  },
  async ({ contextRef, action, seedOverride }) =>
    safe(() => session.requestAction({ contextRef, action, seedOverride })),
)

server.registerTool(
  'receiveResult',
  {
    description:
      'Read back the result of a requested action plus its verify verdict ({ green, totalSlots, filledSlots, unfilledSlots, failures }). Returns { actionRef, contextRef, result, verify, state }.',
    inputSchema: { actionRef: z.string() },
  },
  async ({ actionRef }) => safe(() => session.receiveResult({ actionRef })),
)

server.registerTool(
  'confirm',
  {
    description:
      'Accept a result (must be ok/green). Computes an acceptedSeed = sha256(inputsHash + sorted slot recipe-tuples), mirroring the product accept flow. Returns { acceptedRef, actionRef, acceptedSeed, state }. Refuses to confirm a failed generation.',
    inputSchema: { actionRef: z.string() },
  },
  async ({ actionRef }) => safe(() => session.confirm({ actionRef })),
)

server.registerTool(
  'rollback',
  {
    description:
      'Discard the current draft result (or accept) and return to the current context so it can be refined and re-requested. Returns { state, restoredContextRef, discardedActionRef, reason }.',
    inputSchema: { reason: z.string().optional() },
  },
  async ({ reason }) => safe(() => session.rollback({ reason })),
)

const transport = new StdioServerTransport()
await server.connect(transport)
