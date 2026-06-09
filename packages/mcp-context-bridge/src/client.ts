// The MCP context-bridge client library.
//
// A thin, typed facade over a ProtocolTransport exposing exactly the five
// protocol verbs. Consumers (the experiment harness, tests, or an agent) depend
// on this — never on the session directly — so the same code works in-process
// or across a stdio MCP boundary.

import { InProcessTransport, type ProtocolTransport } from './transport.js'
import type {
  ConfirmArgs,
  ConfirmResult,
  ReceiveResultArgs,
  ReceiveResultResult,
  RequestActionArgs,
  RequestActionResult,
  RollbackArgs,
  RollbackResult,
  SendContextArgs,
  SendContextResult,
} from './types.js'

export class ContextBridgeClient {
  constructor(private readonly transport: ProtocolTransport) {}

  sendContext(args: SendContextArgs): Promise<SendContextResult> {
    return this.transport.sendContext(args)
  }

  requestAction(args: RequestActionArgs): Promise<RequestActionResult> {
    return this.transport.requestAction(args)
  }

  receiveResult(args: ReceiveResultArgs): Promise<ReceiveResultResult> {
    return this.transport.receiveResult(args)
  }

  confirm(args: ConfirmArgs): Promise<ConfirmResult> {
    return this.transport.confirm(args)
  }

  rollback(args: RollbackArgs = {}): Promise<RollbackResult> {
    return this.transport.rollback(args)
  }
}

// Convenience: a client wired to a fresh in-process session.
export const createInProcessClient = (): ContextBridgeClient =>
  new ContextBridgeClient(new InProcessTransport())
