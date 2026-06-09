import { describe, expect, it } from 'vitest'
import { createInProcessClient } from '../client.js'
import { makeFeasibleContext, makeInfeasibleContext } from '../scenario.js'

// MCP round-trip integrity: exercise all five verbs through the client.
describe('five-verb protocol round trip', () => {
  it('sendContext → requestAction → receiveResult → confirm (happy path)', async () => {
    const client = createInProcessClient()
    const sent = await client.sendContext({ context: makeFeasibleContext() })
    expect(sent.contextRef).toMatch(/^ctx-\d+$/)
    expect(sent.contextHash).toMatch(/^[0-9a-f]{64}$/)
    expect(sent.state).toBe('context_set')

    const requested = await client.requestAction({
      contextRef: sent.contextRef,
      action: 'generate_menu',
    })
    expect(requested.actionRef).toMatch(/^act-\d+$/)
    expect(requested.state).toBe('result_ready')

    const received = await client.receiveResult({ actionRef: requested.actionRef })
    expect(received.result.ok).toBe(true)
    expect(received.verify.green).toBe(true)
    expect(received.verify.filledSlots).toBe(received.verify.totalSlots)

    const confirmed = await client.confirm({ actionRef: requested.actionRef })
    expect(confirmed.acceptedSeed).toMatch(/^[0-9a-f]{64}$/)
    expect(confirmed.state).toBe('confirmed')
  })

  it('rollback discards the draft and returns to the current context', async () => {
    const client = createInProcessClient()
    const sent = await client.sendContext({ context: makeFeasibleContext() })
    const requested = await client.requestAction({
      contextRef: sent.contextRef,
      action: 'generate_menu',
    })
    const rolled = await client.rollback({ reason: 'changed my mind' })
    expect(rolled.state).toBe('context_set')
    expect(rolled.restoredContextRef).toBe(sent.contextRef)
    expect(rolled.discardedActionRef).toBe(requested.actionRef)
    expect(rolled.reason).toBe('changed my mind')
  })

  it('requestAction on a superseded context is rejected as stale', async () => {
    const client = createInProcessClient()
    const first = await client.sendContext({ context: makeFeasibleContext() })
    await client.sendContext({ context: makeFeasibleContext() }) // supersedes `first`
    await expect(
      client.requestAction({ contextRef: first.contextRef, action: 'generate_menu' }),
    ).rejects.toMatchObject({ code: 'stale_context' })
  })

  it('confirm refuses a failed generation', async () => {
    const client = createInProcessClient()
    const sent = await client.sendContext({ context: makeInfeasibleContext() })
    const requested = await client.requestAction({
      contextRef: sent.contextRef,
      action: 'generate_menu',
    })
    const received = await client.receiveResult({ actionRef: requested.actionRef })
    expect(received.verify.green).toBe(false)
    await expect(client.confirm({ actionRef: requested.actionRef })).rejects.toMatchObject({
      code: 'cannot_confirm_failed',
    })
  })
})
