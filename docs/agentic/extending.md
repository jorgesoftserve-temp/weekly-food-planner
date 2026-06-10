# Extending the agentic infrastructure

Playbook for adding a new agent, skill, or CLAUDE.md file to the Weekly Food Planner. Read [`architecture.md`](./architecture.md) first if you're unsure which layer your work belongs in.

## Decision tree

```
Is the work always the same deterministic walk against a fixed checklist
producing multi-artifact output?
  └── Yes → Skill         (.claude/skills/<name>/SKILL.md + docs/examples/)
  └── No  → Is it specialist work that exercises judgment per invocation,
            and would benefit from its own context window?
              └── Yes → Sub-agent   (.claude/agents/<name>.md)
              └── No  → Is it a project-wide convention that should apply
                       to every session?
                         └── Yes → Cursor rule  (.cursor/rules/<name>.md)
                         └── No  → Per-area orientation
                                   └── New top-level area? → New CLAUDE.md
                                   └── Existing area?      → Edit existing CLAUDE.md
```

## Adding a sub-agent

### Step 1 — Confirm it should be an agent, not a skill

If you find yourself listing "every time we do X, walk these N steps and emit these N files" — that's a skill. Agents handle work where two invocations produce different shapes of output.

Common agent patterns in this repo:

- Building UI for a specific feature
- Writing a route handler whose validation and auth shape varies
- Reviewing a PR against the PRDs
- Auditing accessibility on a flow

### Step 2 — Pick a tight scope

The description must answer **when to use** and **when NOT to use** explicitly. Vague scopes lead to overlap with existing agents.

Bad: `database-helper` — "Use for any database work."
Good: `supabase-migration-author` — "Use for any schema change to the Supabase database — new tables, columns, enums, RLS policies, functions/RPCs, triggers, indexes. Do NOT bypass and write SQL directly into an arbitrary file; always start from `npx supabase migration new`."

### Step 3 — Write the file

Location: [`.claude/agents/<name>.md`](../../.claude/agents/) — kebab-case filename.

Required frontmatter:

```yaml
---
name: <kebab-case>
description: <one full sentence — when to use AND when NOT to use; the harness uses this for auto-discovery>
model: sonnet
---
```

Body sections (in order):

1. **Framing paragraph** — one paragraph pointing at the relevant CLAUDE.md and/or PRD the agent must read before producing code.
2. **Operating rules** — numbered non-negotiables, ≤10 items. The fewer, the better — only what's actually load-bearing.
3. **Domain-specific guidance** — patterns the agent should follow (e.g. "Menu generation pipeline rules" for `route-handler-engineer`).
4. **Pre-flight checklist** (optional but recommended) — quick yes/no questions the agent asks itself before producing code.
5. **When to hand off** — adjacent agents/skills the work might need to chain into.
6. **Output expectations** — exactly what to return to the parent session. The parent doesn't see the agent's tool calls; it sees only the final message.

### Step 4 — Register (two writes)

The source file is authoritative and the harness auto-discovers it from the frontmatter `description`, so registration is deliberately minimal:

1. Add a one-line row to the agent table in [root `CLAUDE.md`](../../CLAUDE.md) — the auto-loaded index.
2. Put the *why* (scope decision, what it replaces) in the **commit message**.

That's it. [`agents.md`](./agents.md) is a thin pointer (no per-agent table to keep in sync), [root `README.md`](../../README.md) points at CLAUDE.md rather than re-listing agents, and there is no changelog entry to write (see the [frozen changelog](./changelog/README.md)).

### Step 5 — Test

Invoke the agent on a representative task. Confirm:

- The frontmatter description triggers auto-discovery (the harness lists the agent in `system-reminder` blocks).
- The agent reads the right reference files before producing output.
- The hand-off section accurately routes adjacent work.
- The output matches the "Output expectations" section verbatim.

## Adding a skill

### Step 1 — Confirm it should be a skill

Skills are the right answer when:

- The work has a fixed checklist or workflow
- The output is multi-artifact and files must stay aligned
- The pattern is repeated often (weekly+)
- Mistakes are subtle and worth catching mechanically

If any of those is false, it's probably an agent or just inline work.

### Step 2 — Write `SKILL.md`

Location: [`.claude/skills/<name>/SKILL.md`](../../.claude/skills/) — kebab-case directory + `SKILL.md` filename.

Required frontmatter:

```yaml
---
name: <kebab-case>
description: <one full sentence — when to invoke AND when NOT to invoke. The harness shows this in the available-skills list so the model can route correctly.>
---
```

Body sections (in order):

1. **One-paragraph framing** — what the skill produces and why it exists.
2. **When to invoke** — explicit scope, ≤5 bullets.
3. **When NOT to invoke** — out-of-scope cases, each with the right alternative named (e.g. "→ use `<agent-name>` instead").
4. **Input** — the shape the skill expects. If it's YAML, show the schema with comments. If it's prose, list what the skill will ask for in the single batched clarification.
5. **Authoritative repo references** — table of files the emitted output must stay consistent with. Cite live files; if a file's shape changes between revisions, the skill should defer to the live file.
6. **Steps** — the deterministic workflow, numbered.
7. **Report structure / output template** — what the skill returns. For emit-style skills (code generators), this is the file list + commands. For planning skills, this is the markdown structure of the report.
8. **Non-negotiables** — rules the workflow must not violate.
9. **What to flag in the report** — surface conditions worth raising to the user (e.g. "missing data the migration can't supply").

### Step 3 — Write at least one worked example

Location: [`.claude/skills/<name>/docs/examples/<example>.{md,yaml}`](../../.claude/skills/).

The example shows either:

- A real input the skill would consume (YAML), and what it should emit.
- A worked output the skill would produce (markdown), with annotations on the choices.

Two examples is better than one for complex skills.

### Step 4 — Register (two writes)

1. Add a one-line bullet to the skill list in [root `CLAUDE.md`](../../CLAUDE.md).
2. Put the *why* in the **commit message**.

The harness auto-discovers `SKILL.md` from its frontmatter, [`skills.md`](./skills.md) is a thin pointer (no per-skill table), and there is no changelog entry to write.

### Step 5 — Test

Invoke the skill on a representative task. Confirm:

- The harness lists the skill in `system-reminder` blocks.
- The workflow produces the documented artifacts.
- The "Non-negotiables" section catches at least one mistake the skill would otherwise make.

## Adding a CLAUDE.md

### When to add one

- New top-level area whose conventions warrant orientation (e.g. if `packages/test-utils/` grows enough complexity).
- An area whose conventions diverge significantly from its parent in a way that isn't obvious from existing rules.

### When NOT to add one

- Feature folders inside an existing app — feature conventions live in the parent CLAUDE.md or in agent files.
- Subdirectories that mirror their parent's conventions — adding a CLAUDE.md there is noise.
- For documentation that should be referenced on demand — that belongs in [`docs/`](../) and gets linked from CLAUDE.md.

### Step 1 — Write the file

Location: `<area>/CLAUDE.md`.

Body sections:

1. **One-paragraph framing** — what this area is and what to load when working on it.
2. **Layout** — directory tree with one-line descriptions per folder.
3. **Conventions** — the rules specific to this area.
4. **Hard rules** (optional) — non-negotiables that, if broken, cause real harm (engine determinism, RLS policies, etc.).
5. **Delegate to** — adjacent agents for work in this area.

### Step 2 — Keep it short

Target < 200 lines. If you need more, split heavy reference material into [`docs/`](../) and link to it.

### Step 3 — Register

- Reference the new file from the root [`CLAUDE.md`](../../CLAUDE.md) "Where to read more" section, and add a row to the inventory in [`claude-md.md`](./claude-md.md).

## Updating a cursor rule

Cursor rules in [`.cursor/rules/`](../../.cursor/rules/) are read by both Cursor and Claude Code. Update them when a project-wide convention genuinely changes.

For Claude Code, prefer CLAUDE.md for orientation and cursor rules for **always-loaded** project-wide rules. They serve different purposes and should not duplicate each other.

After updating a cursor rule:

- Check whether any CLAUDE.md, agent file, or skill needs to follow.
- Note the *why* in the commit message if the change affects how agents or skills work.

## Conventions across all agentic files

### Frontmatter

- `name` is kebab-case and matches the filename.
- `description` is a single full sentence ending with a period. Include both **when to use** and **when NOT to use**.
- `model` for agents — default `sonnet`. Use `haiku` for narrowly-scoped fast work, `opus` only when the agent genuinely needs deeper reasoning.

### File path citations

Use the IDE-friendly markdown link format throughout:

```
[filename.ts](relative/path/from/repo/root/filename.ts)
[filename.ts:42](relative/path/from/repo/root/filename.ts#L42)
[filename.ts:42-51](relative/path/from/repo/root/filename.ts#L42-L51)
```

Avoid backticks for file paths in agent and skill files — the IDE renders the markdown links as clickable.

### RO-RO in output expectations

Where an agent or skill emits TypeScript that has callbacks, the callbacks must follow RO-RO: `({ values, slot }: { values: T; slot: U }) => void`. Match the existing repo style.

### Hand-off discipline

Every agent and skill ends with a hand-off section. The chain should be **complete** — if a task crosses three layers (DB + handler + UI), the chain lists all three even if the parent session will only invoke the first one.

### Worked examples for skills

Every skill needs at least one example. Two for complex skills. Examples are the single most useful artifact when an agent reads the SKILL.md for the first time — they ground the abstract workflow in a concrete shape.

### Recording why a change was made

The dated [`changelog/`](./changelog/) is **frozen** (see its [README](./changelog/README.md)) — it duplicated `git log`. Record the rationale for a toolchain change in the **commit message** instead. If the change establishes a durable convention (not a one-off), fold it into this file or [`architecture.md`](./architecture.md) so it's discoverable. `git log -- docs/agentic .claude .mcp.json` is the audit trail; per-session history still lives in [`agent-log/`](../../agent-log/).
