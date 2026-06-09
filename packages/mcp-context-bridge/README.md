# @weekly-food-planner/mcp-context-bridge

A minimal **MCP context-protocol** library + stub server, plus a deterministic
**verify→refine experiment** that compares a naive ("Module-1") agent dev-loop against the
protocol-mediated ("MCP") loop. Built on the repo's deterministic constraint engine so every
number is reproducible in CI with **no live model calls**.

> Scope note: this is a course/research artifact. The "MCP" here is a 5-verb **context protocol**
> (sendContext / requestAction / receiveResult / confirm / rollback), distinct from the product's
> `menu` MCP *tool* server in [`apps/menu-mcp-server/`](../../apps/menu-mcp-server/). The bridge
> drives the same engine; it just wraps it in the protocol the experiment measures.

## The five verbs

| Verb | Purpose |
|---|---|
| `sendContext` | Register a context envelope (intent + engine input), get a `contextRef` + content `contextHash`. |
| `requestAction` | Run `generate_menu` (the deterministic engine) over the current context. |
| `receiveResult` | Read back the result + a `verify` verdict (green/red, filled slots, failures). |
| `confirm` | Accept a green result; returns an `acceptedSeed` (mirrors the product accept flow). |
| `rollback` | Discard the current draft/accept and return to the context to refine + retry. |

Full message shapes + the state machine: [`docs/context-schema.md`](./docs/context-schema.md).

## Layout

```
src/
  types.ts        schema.ts        verify.ts       session.ts (state machine)
  transport.ts    client.ts        server.ts (stdio MCP stub)   index.ts
  scenario.ts     iteration-log.ts
  agents/         { types.ts, mcp-agent.ts, naive-agent.ts }
  experiment/     { run-loop.ts, metrics.ts, experiment.ts }
  __tests__/      { schema, round-trip, verify-refine, experiment }.test.ts
docs/             context-schema.md, comparison-report.md
fixtures/         context.feasible.json, context.infeasible.json   (generated)
logs/             agent-iteration-log.{jsonl,md}, experiment-metrics.json  (generated)
scripts/          run-experiment.mjs
```

## Run it

```sh
pnpm --filter @weekly-food-planner/mcp-context-bridge test         # unit + integration suite
pnpm --filter @weekly-food-planner/mcp-context-bridge typecheck
pnpm --filter @weekly-food-planner/mcp-context-bridge experiment   # regenerate logs + fixtures + metrics
pnpm --filter @weekly-food-planner/mcp-context-bridge start        # boot the stdio MCP stub server
```

The experiment runs **3 controlled runs of the baseline flow and 3 of the MCP flow** over the same
over-constrained scenario (3 unsatisfiable required dietary tags → `no_valid_recipe`), and writes
the iteration log + metrics. Both flows verify with the same pure `verifyResult`; the only
differences are the protocol and the agent it enables.

## The experiment, in one paragraph

The scenario is intentionally infeasible at the start (a "simulated failing generation"). The
**baseline (Module-1)** agent only sees the `ok` flag and guesses blindly with a seeded RNG —
half its moves are no-ops (reroll seed, add a cuisine), so it wanders and its move sequence varies
by seed. The **MCP** agent reads the structured context+result through `receiveResult`, identifies
exactly which required tags are unsatisfiable, and removes one per step — never wasting a move,
never consulting the RNG, so it converges identically every run (zero output variance). Results:
[`docs/comparison-report.md`](./docs/comparison-report.md).

## Deliverables → files

| Deliverable | Where |
|---|---|
| MCP client library | [`src/client.ts`](./src/client.ts) (+ [`transport.ts`](./src/transport.ts)) |
| Minimal MCP server / stub (5 verbs) | [`src/server.ts`](./src/server.ts) (+ [`session.ts`](./src/session.ts)) |
| Context schema doc | [`docs/context-schema.md`](./docs/context-schema.md) |
| Example JSON context snapshots | [`fixtures/`](./fixtures/) |
| CI tests (round-trip + verify→refine + failing generation) | [`src/__tests__/`](./src/__tests__/) |
| agent_iteration_log | [`logs/agent-iteration-log.{jsonl,md}`](./logs/) |
| One-page comparison report (metrics) | [`docs/comparison-report.md`](./docs/comparison-report.md) |
