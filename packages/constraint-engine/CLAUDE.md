# packages/constraint-engine CLAUDE.md

The deterministic menu generator. Load when editing anything under [`src/`](./src/).

## Hard rules (the engine breaks if you violate any of these)

1. **No I/O.** No `fs`, no `fetch`, no Supabase client, no logging beyond what the caller injects.
2. **No clocks.** Forbidden: `Date.now()`, `new Date()`, `performance.now()`. If the caller needs a timestamp, it comes in via the input.
3. **No ambient randomness.** Forbidden: `Math.random()`, `crypto.randomUUID()` (and any crypto call without a seed-derived source). Use the seeded RNG from [`src/random.ts`](./src/random.ts).
4. **No app-package imports.** The engine has zero awareness of `apps/web` or `@weekly-food-planner/supabase`. It is a pure library.
5. **JSON-round-trippable boundary.** `GenerateMenuInput` and `GenerateMenuResult` must survive `JSON.parse(JSON.stringify(x))`. No `Date`, no `Map`, no `Set`, no `BigInt`, no class instances, no functions, no circular refs. Use ISO 8601 strings, plain objects, arrays, numbers, booleans.

## Surface area

| File | Purpose |
|---|---|
| [`src/types.ts`](./src/types.ts) | `GenerateMenuInput`, `GenerateMenuResult`, snapshot types. Public contract. |
| [`src/random.ts`](./src/random.ts) | Seeded RNG. Single source of non-determinism. |
| [`src/canonical.ts`](./src/canonical.ts) | Canonical JSON serializer for the input — feeds the hash. |
| [`src/hash.ts`](./src/hash.ts) | SHA-256 of the canonical input → `inputs_hash`. |
| [`src/filter.ts`](./src/filter.ts) | Hard-constraint filter. The union of member-profile constraints and the per-menu overlay (`additionalDietaryRestrictions`, `additionalAllergies`, `ingredientExclusions`). |
| [`src/slots.ts`](./src/slots.ts) | Slot enumeration. Honours `participantMemberIds` and the override → member → workspace → empty frequency cascade. |
| [`src/assign.ts`](./src/assign.ts) | Greedy assignment + local-search refinement. RNG-driven tie breaks. |
| [`src/grocery.ts`](./src/grocery.ts) | Aggregation with the `eaters / recipe.servings` scaling rule. |
| [`src/generate.ts`](./src/generate.ts) | The public `generateMenu` function. |
| [`src/index.ts`](./src/index.ts) | Barrel — only export what callers should depend on. |

## Boundary contract

```ts
export type GenerateMenuInput = {
  workspace: WorkspaceSnapshot
  members: MemberSnapshot[]            // already filtered to participants by the route handler
  recipes: RecipeSnapshot[]            // already filtered to is_deleted = false
  weekStartDate: string                // ISO 8601 date — engine derives day-of-week
  durationDays: number                 // 1..7
  seed: number
  options?: {
    calorieTolerance?: number
    repetitionLimit?: number
    preferredCuisines?: string[]
    ingredientExclusions?: string[]
    additionalDietaryRestrictions?: string[]   // EFFECTIVE overlay (post-dedup by the route handler)
    additionalAllergies?: string[]             // EFFECTIVE overlay (post-dedup by the route handler)
    memberFrequencyOverrides?: Array<{
      memberId: string
      mealFrequency: MealFrequencyEntry[]
    }>
  }
}

export type GenerateMenuResult =
  | { ok: true;  menu: GeneratedMenu; groceryLists: GroceryLists; inputsHash: string }
  | { ok: false; error: GenerationError }
```

The route handler dedupes overlay values and filters participants **before** invoking the engine. The engine never receives raw user input — what it sees is the effective set.

## Frequency cascade

For each participating member the engine resolves their frequency in this order:

1. `options.memberFrequencyOverrides` entry whose `memberId` matches.
2. `member.mealFrequency` (their profile override).
3. `workspace.sharedMealFrequency` (the shared group default).
4. Empty (no slots for this member this menu).

## Determinism contract

- Same `(input, seed)` always produces the same `menu` and same `groceryLists`.
- `inputsHash` is computed from canonical JSON of the input — overlay dedup and participant filtering happen upstream, so the hash reflects the effective state.
- Golden snapshots under [`src/__tests__/`](./src/__tests__/) lock the engine. CI runs them — any drift fails the build. If the change is intentional, update the snapshots in a separate, isolated commit.

## Trade-offs

The MVP algorithm is greedy + local-search. It is fast, deterministic, and easy to reason about. It does NOT guarantee a globally optimal soft-constraint score. Swap to a stronger search (simulated annealing, CSP) later behind the same boundary if the product needs it — the contract above should not change.

## Tests

Vitest unit tests live under [`src/__tests__/`](./src/__tests__/) and target ≈100% coverage. Required test families:

- Determinism — same input + seed → same output across multiple runs.
- JSON round-trip — `JSON.parse(JSON.stringify(input))` deep-equals `input`, same for the result.
- Overlay-as-union — overlay values combine with member-profile values with no leakage either direction.
- Frequency cascade — override beats member, member beats workspace, workspace beats empty.
- Allergen string-matching — untagged allergen is silently skipped, not raised.
- Grocery scaling — `eaters / recipe.servings` arithmetic holds across shared and member-targeted slots.
- Golden snapshots — regression suite of `(input, seed) → output` pairs.

## Delegate to

- `constraint-engine-engineer` — implementation work inside this package (model: opus).
- `determinism-snapshot-curator` — updating or extending the regression suite (model: opus).

## Related areas (load only what your task needs)

- Root non-negotiables + agent/skill/MCP index → [`CLAUDE.md`](../../CLAUDE.md)
- Who builds the engine input + persists output (the route handler boundary) → [`apps/web/CLAUDE.md`](../../apps/web/CLAUDE.md) + [`docs/PRD/ARCHITECTURE_PRD.md §5`](../../docs/PRD/ARCHITECTURE_PRD.md)
- DB shapes the snapshots mirror (`menus`, `menu_slots`, `meal_frequency`) → [`packages/supabase/CLAUDE.md`](../../packages/supabase/CLAUDE.md)
- Scope a menu/grocery change before coding → `menu-generation-impact-review` skill.
