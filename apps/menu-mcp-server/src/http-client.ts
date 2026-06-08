// HTTP client for the workspace.* MCP tools. Talks to the running Next.js
// app via an authenticated bearer JWT (MENU_MCP_USER_JWT) at the base URL
// MENU_MCP_BASE_URL.
//
// The MCP server never holds a service-role key. It impersonates a real
// workspace member, so it sees only what that member can see — RLS still
// applies. This is intentional: it bounds blast radius and matches what a
// real user would experience.
//
// engine.* tools (pure constraint-engine wrappers) work without this config.
// workspace.* tools throw a structured error when JWT is unset.

const BASE_URL = process.env.MENU_MCP_BASE_URL ?? 'http://127.0.0.1:3000'
const USER_JWT = process.env.MENU_MCP_USER_JWT

export class MenuMcpHttpError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'MenuMcpHttpError'
    this.status = status
    this.body = body
  }
}

export const isHttpConfigured = (): boolean =>
  USER_JWT !== undefined && USER_JWT.length > 0

const requireHttpConfigured = (): void => {
  if (!isHttpConfigured()) {
    throw new Error(
      'MENU_MCP_USER_JWT is not set. workspace.* tools require auth — see apps/menu-mcp-server/README.md.',
    )
  }
}

export type HttpRequestArgs = {
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  query?: Record<string, string | undefined>
}

const safelyParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const httpRequest = async <T>({
  method,
  path,
  body,
  query,
}: HttpRequestArgs): Promise<T> => {
  requireHttpConfigured()
  const url = new URL(path, BASE_URL)
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
  }
  const response = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${USER_JWT ?? ''}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const parsed = text.length > 0 ? safelyParseJson(text) : null
  if (!response.ok) {
    throw new MenuMcpHttpError(
      `${method} ${path} → ${response.status}`,
      response.status,
      parsed,
    )
  }
  return parsed as T
}
