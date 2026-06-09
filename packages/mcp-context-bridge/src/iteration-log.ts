// The agent_iteration_log.
//
// Records, for every step of every run, the five fields the deliverable
// requires: prompt, input context, agent output, diffs applied, human
// decisions. Deterministic (no timestamps) so it round-trips and snapshot-tests
// cleanly. Renders to JSONL (machine) and Markdown (human).

import type { ContextDiff, ContextEnvelope, VerifyVerdict } from './types.js'

export type IterationLogEntry = {
  flow: string
  agentSeed: number
  step: number
  phase: 'verify' | 'refine'
  prompt: string
  inputContextRef: string | null
  inputContextHash: string | null
  inputContextSummary: Record<string, unknown>
  agentOutput: string
  verdict: VerifyVerdict | null
  diffApplied: ContextDiff | null
  humanDecision: string
}

// The tunable surface of a context, flattened for the log.
export const summarizeContext = (c: ContextEnvelope): Record<string, unknown> => ({
  intent: c.intent,
  seed: c.payload.seed,
  additionalDietaryRestrictions: c.payload.options?.additionalDietaryRestrictions ?? [],
  preferredCuisines: c.payload.options?.preferredCuisines ?? [],
  recipeCount: c.payload.recipes.length,
  memberCount: c.payload.members.length,
})

export class IterationLog {
  private readonly entries: IterationLogEntry[] = []

  record(entry: IterationLogEntry): void {
    this.entries.push(entry)
  }

  all(): readonly IterationLogEntry[] {
    return this.entries
  }

  toJsonl(): string {
    return this.entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  }

  toMarkdown(): string {
    const lines: string[] = ['# agent_iteration_log', '']
    let currentRun = ''
    for (const e of this.entries) {
      const runKey = `${e.flow} · seed ${e.agentSeed}`
      if (runKey !== currentRun) {
        currentRun = runKey
        lines.push(`## ${runKey}`, '')
      }
      const diff =
        e.diffApplied === null
          ? '—'
          : `\`${e.diffApplied.field}\` ${e.diffApplied.op}: ${JSON.stringify(e.diffApplied.from)} → ${JSON.stringify(e.diffApplied.to)} (${e.diffApplied.note})`
      lines.push(
        `### step ${e.step} · ${e.phase}`,
        `- **prompt**: ${e.prompt}`,
        `- **input context**: ${e.inputContextRef ?? '—'} (${(e.inputContextHash ?? '').slice(0, 12)}…) — ${JSON.stringify(e.inputContextSummary)}`,
        `- **agent output**: ${e.agentOutput}`,
        `- **diff applied**: ${diff}`,
        `- **human decision**: ${e.humanDecision}`,
        '',
      )
    }
    return lines.join('\n')
  }
}
