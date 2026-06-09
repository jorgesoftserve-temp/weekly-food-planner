// Transport abstraction for the five verbs.
//
// The client talks to a ProtocolTransport. InProcessTransport binds the client
// straight to a ProtocolSession (used by tests + the experiment harness, no
// stdio). A stdio/MCP-backed transport could implement the same interface to
// drive the server in src/server.ts across a process boundary.

import { ProtocolSession } from './session.js'
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

export interface ProtocolTransport {
  sendContext(args: SendContextArgs): Promise<SendContextResult>
  requestAction(args: RequestActionArgs): Promise<RequestActionResult>
  receiveResult(args: ReceiveResultArgs): Promise<ReceiveResultResult>
  confirm(args: ConfirmArgs): Promise<ConfirmResult>
  rollback(args?: RollbackArgs): Promise<RollbackResult>
}

export class InProcessTransport implements ProtocolTransport {
  constructor(private readonly session: ProtocolSession = new ProtocolSession()) {}

  async sendContext(args: SendContextArgs): Promise<SendContextResult> {
    return this.session.sendContext(args)
  }

  async requestAction(args: RequestActionArgs): Promise<RequestActionResult> {
    return this.session.requestAction(args)
  }

  async receiveResult(args: ReceiveResultArgs): Promise<ReceiveResultResult> {
    return this.session.receiveResult(args)
  }

  async confirm(args: ConfirmArgs): Promise<ConfirmResult> {
    return this.session.confirm(args)
  }

  async rollback(args: RollbackArgs = {}): Promise<RollbackResult> {
    return this.session.rollback(args)
  }
}
