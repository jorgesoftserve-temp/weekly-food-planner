# Comparison report — Module-1 baseline vs MCP context-bridge

**Scenario.** Repair an intentionally over-constrained menu request: `additionalDietaryRestrictions
= ["gluten-free","keto","vegan"]` against four recipes that carry **no** dietary tags, so the
engine returns `ok:false` (`no_valid_recipe`) — a *simulated failing generation*. A run is **green**
when the engine returns `ok:true` with every derived slot filled (14/14). Both flows verify with
the same pure `verifyResult`; **the only variables are the protocol and the agent it enables.**

**Method.** 3 controlled runs per flow (agent RNG seeds `1,2,3`), `maxIterations = 8`. Agent
responses are mocked seeded policies — no live model calls — so the experiment is fully
deterministic and reproducible in CI (`experiment.test.ts` asserts byte-identical metrics across
repeats). Regenerate with `pnpm --filter @weekly-food-planner/mcp-context-bridge experiment`.
Raw data: [`../logs/experiment-metrics.json`](../logs/experiment-metrics.json); full trace:
[`../logs/agent-iteration-log.md`](../logs/agent-iteration-log.md).

## Results (measured)

| Metric | Baseline (Module-1) | MCP context-bridge |
|---|---|---|
| Iterations to green, per run | `[8, 8, 5]` | `[4, 4, 4]` |
| **Mean iterations to green** | **7.0** | **4.0** |
| **Variance of agent output** (across 3 runs) | **2.0** | **0.0** |
| Distinct diff signatures (3 runs) | **3** | **1** |
| **Test (green) pass rate** | **0.67** (2/3) | **1.0** (3/3) |
| Refinements applied, per run | `[7, 8, 4]` | `[3, 3, 3]` |

## Reading the numbers

- **Iteration count.** The MCP flow needs exactly the minimum: 3 surgical removals + 1 confirming
  generation = **4** every time. The baseline averages **7** because half its repertoire (reroll
  seed, add a preferred cuisine) is a no-op for feasibility — pure wasted iterations visible in the
  log (e.g. seed 1: `seed 42→43`, `preferredCuisines []→["cuisine-2"]`).
- **Output variance.** The MCP agent reads the structured `receiveResult` payload, identifies the
  unsatisfiable required tags from the context's own recipes, and removes one per step in sorted
  order — it never consults the RNG, so all three runs apply the **identical** diff sequence
  (variance **0**, **1** distinct signature). The baseline's blind RNG-driven guessing yields **3**
  different diff sequences (variance **2**).
- **Pass rate.** Two baseline runs reached green (at 5 and 8 generations); the third **exhausted the
  8-iteration budget still red** — 0.67. The MCP flow never fails within budget — 1.0.
- **Determinism preserved.** The engine itself is deterministic for a fixed `(input, seed)`; all
  observed variance is in *agent behaviour*, not the engine. The MCP flow's `confirm` produces a
  stable `acceptedSeed`, identical across runs.

## Developer-time / friction notes

Wall-clock human time was **not** measured (the agent is a mocked seeded policy, not a person), so
the proxies below stand in for developer effort:

- **Engine calls (cost proxy).** Baseline burned **21** generations across 3 runs (8+8+5) vs the MCP
  flow's **12** (4+4+4) — ~43% fewer calls for the same outcome, and a *guaranteed* outcome.
- **Friction — baseline.** No structured feedback: the agent only sees `ok:false`, so it cannot tell
  *which* constraint is the offender and resorts to guessing; ~half its moves change nothing; there
  is no rollback bookkeeping, so a failed attempt is silently discarded. One run never converged.
- **Friction — MCP.** The protocol makes the failing reason inspectable (`receiveResult.verify` +
  the context's recipes), `rollback` cleanly discards a failed draft before the next attempt, and
  `confirm` gates acceptance on a green result (it *refuses* to confirm a failure). Every step is
  self-documenting in the iteration log.

## Threats to validity

- The contrast is engineered: the baseline's no-op moves are deliberately wasteful and the MCP
  agent's analysis is tailored to this constraint class. The experiment demonstrates the *value of
  structured context + confirm/rollback* on a representative repair task — it is **not** a claim
  about arbitrary tasks.
- A single scenario and three seeds. The harness is parameterised (`ExperimentConfig`) to widen
  this; the conclusion (structured feedback lowers iteration count and variance, raises pass rate)
  is expected to hold across constraint-repair scenarios but should be re-measured per scenario.

## Conclusion

On this constraint-repair task the MCP context-bridge flow was **strictly better on every metric**:
fewer iterations (4 vs 7 mean), zero output variance (vs 2), a single deterministic diff path (vs 3),
and a perfect green-pass rate (1.0 vs 0.67) — at ~43% fewer engine calls. The lever is the
**structured context + result read-back and the confirm/rollback discipline**, which let the agent
make targeted, reproducible refinements instead of blind guesses.
