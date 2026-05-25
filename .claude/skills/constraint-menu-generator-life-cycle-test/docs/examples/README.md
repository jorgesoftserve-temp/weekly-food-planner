# Example specs

Reference inputs for the `constraint-menu-generator-life-cycle-test` skill. Hand any of these to the skill to verify it produces sane Vitest + mjs artifacts. They're designed to exercise distinct code paths, not to be exhaustive.

| File | What it covers |
|---|---|
| [basic-flow.yaml](./basic-flow.yaml) | Minimal happy path: 1 member, 2 meals/day, 3 recipes, no dietary constraints. Mirrors the scope of `scripts/verify-flow.mjs`. Use this as a smoke test — if the skill can't handle this, it can't handle anything. |
| [peanut-allergy-mixed-household.yaml](./peanut-allergy-mixed-household.yaml) | Constraints living at three different layers: a per-member allergy (child can't have peanuts), an overlay-level extra restriction (`vegetarian` added for a guest at dinner), and a soft cuisine preference (`italian`). Exercises the engine's member-filter vs. overlay-filter split and the `groceryShouldNotContain` assertion path. |

## Invoking the skill against an example

The skill takes a spec; how you pass it through is up to the harness. The natural shape is:

```
/constraint-menu-generator-life-cycle-test
  spec=.claude/skills/constraint-menu-generator-life-cycle-test/docs/examples/basic-flow.yaml
```

…or paste the YAML body inline. The skill will read it, optionally ask one clarifying question if anything is genuinely ambiguous, then emit:

- `packages/supabase/src/module/__tests__/<scenario>.integration.test.ts`
- `scripts/flow-<scenario>.mjs`

Neither file is run by the skill itself — both have runtime preconditions (env vars for the Vitest test, `pnpm db:start` + `pnpm dev` for the driver). The skill's job ends at emission; verification is the next step.

## Adding an example

Keep new examples small and **single-purpose**. If an example tries to demonstrate four things at once, it stops being useful as a regression case. A good example has one obvious failure mode you'd catch if the skill misbehaved (e.g. "if the skill drops the overlay restriction, this scenario's `excludedRecipeNames` assertion fires").
