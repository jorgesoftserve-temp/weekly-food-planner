// Shared helpers + types across tool files.
//
// `ToolCallResult` is the narrow shape every tool in this server returns. The
// MCP SDK accepts a broader CallToolResult (multiple content kinds,
// structuredContent, isError flag), but every menu MCP tool today returns a
// single JSON-stringified text block. Centralising the type here makes the
// handler signature consistent and lets tests assert on a stable shape.

export type ToolCallResult = {
  content: Array<{ type: 'text'; text: string }>
}

// Helper that wraps an arbitrary value into the standard text-block envelope.
// Use this in every tool to keep the envelope shape from drifting.
export const textResult = (value: unknown): ToolCallResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
})
