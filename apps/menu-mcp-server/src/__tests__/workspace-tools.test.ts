import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../http-client.js', () => ({
  httpRequest: vi.fn(),
  isHttpConfigured: vi.fn(() => true),
}))

const httpModule = await import('../http-client.js')
const httpRequest = httpModule.httpRequest as unknown as ReturnType<typeof vi.fn>

const { workspacePreviewMenuHandler } = await import('../tools/workspace-preview-menu.js')
const { workspaceMemberConstraintsHandler } = await import(
  '../tools/workspace-member-constraints.js'
)
const { workspaceRecipeUsabilityHandler } = await import(
  '../tools/workspace-recipe-usability.js'
)
const { workspaceRecentMenusHandler } = await import('../tools/workspace-recent-menus.js')

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const RECIPE_ID = '33333333-3333-4333-8333-333333333333'

const parseFirstText = (result: { content: Array<{ type: 'text'; text: string }> }) => {
  const block = result.content[0]
  if (block === undefined) throw new Error('expected at least one content block')
  return JSON.parse(block.text) as unknown
}

beforeEach(() => {
  httpRequest.mockReset()
})

describe('workspacePreviewMenuHandler', () => {
  it('POSTs to /menus/preview with only the supplied fields in the body', async () => {
    httpRequest.mockResolvedValueOnce({ ok: true, mode: 'preview', menu: {} })
    await workspacePreviewMenuHandler({
      workspaceId: WORKSPACE_ID,
      weekStartDate: '2026-06-01',
    })
    expect(httpRequest).toHaveBeenCalledTimes(1)
    expect(httpRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: `/api/workspaces/${WORKSPACE_ID}/menus/preview`,
      body: { weekStartDate: '2026-06-01' },
    })
  })

  it('forwards optional fields verbatim when provided', async () => {
    httpRequest.mockResolvedValueOnce({ ok: true })
    await workspacePreviewMenuHandler({
      workspaceId: WORKSPACE_ID,
      weekStartDate: '2026-06-01',
      seed: 42,
      durationDays: 3,
      options: { additionalAllergies: ['peanut'] },
      participantMemberIds: [MEMBER_ID],
    })
    expect(httpRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: `/api/workspaces/${WORKSPACE_ID}/menus/preview`,
      body: {
        weekStartDate: '2026-06-01',
        seed: 42,
        durationDays: 3,
        options: { additionalAllergies: ['peanut'] },
        participantMemberIds: [MEMBER_ID],
      },
    })
  })

  it('returns the route response inside a text content block', async () => {
    const payload = { ok: true, mode: 'preview', inputsHash: 'abc' }
    httpRequest.mockResolvedValueOnce(payload)
    const result = await workspacePreviewMenuHandler({
      workspaceId: WORKSPACE_ID,
      weekStartDate: '2026-06-01',
    })
    expect(parseFirstText(result)).toEqual(payload)
  })
})

describe('workspaceMemberConstraintsHandler', () => {
  it('GETs /members/:memberId/constraints', async () => {
    httpRequest.mockResolvedValueOnce({ ok: true, memberId: MEMBER_ID, dietaryRestrictions: [] })
    await workspaceMemberConstraintsHandler({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_ID,
    })
    expect(httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: `/api/workspaces/${WORKSPACE_ID}/members/${MEMBER_ID}/constraints`,
    })
  })
})

describe('workspaceRecipeUsabilityHandler', () => {
  it('GETs the usability route with memberId as query', async () => {
    httpRequest.mockResolvedValueOnce({ ok: true, eligible: true, blockedBy: [] })
    await workspaceRecipeUsabilityHandler({
      workspaceId: WORKSPACE_ID,
      recipeId: RECIPE_ID,
      memberId: MEMBER_ID,
    })
    expect(httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: `/api/workspaces/${WORKSPACE_ID}/recipes/${RECIPE_ID}/usability`,
      query: { memberId: MEMBER_ID, mealType: undefined },
    })
  })

  it('passes mealType through when supplied', async () => {
    httpRequest.mockResolvedValueOnce({ ok: true })
    await workspaceRecipeUsabilityHandler({
      workspaceId: WORKSPACE_ID,
      recipeId: RECIPE_ID,
      memberId: MEMBER_ID,
      mealType: 'dinner',
    })
    expect(httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: `/api/workspaces/${WORKSPACE_ID}/recipes/${RECIPE_ID}/usability`,
      query: { memberId: MEMBER_ID, mealType: 'dinner' },
    })
  })
})

describe('workspaceRecentMenusHandler', () => {
  it('GETs /menus/history without limit when omitted', async () => {
    httpRequest.mockResolvedValueOnce({ entries: [] })
    await workspaceRecentMenusHandler({ workspaceId: WORKSPACE_ID })
    expect(httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: `/api/workspaces/${WORKSPACE_ID}/menus/history`,
      query: { limit: undefined },
    })
  })

  it('stringifies limit into the query when supplied', async () => {
    httpRequest.mockResolvedValueOnce({ entries: [] })
    await workspaceRecentMenusHandler({ workspaceId: WORKSPACE_ID, limit: 5 })
    expect(httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: `/api/workspaces/${WORKSPACE_ID}/menus/history`,
      query: { limit: '5' },
    })
  })
})
