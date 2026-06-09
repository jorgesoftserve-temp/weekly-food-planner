# Context schema

The unit exchanged over the bridge is a **context envelope**. It is JSON-round-trippable (same
contract as the engine boundary) so it can be serialised, content-addressed (`hashContext`),
logged, and replayed. The executable counterpart is
[`contextEnvelopeSchema`](../src/schema.ts) (zod); example snapshots live in
[`../fixtures/`](../fixtures/).

## `ContextEnvelope`

| Field | Type | Notes |
|---|---|---|
| `kind` | `"menu-generation"` | Literal. The only action domain today. |
| `intent` | `string` (non-empty) | Human-readable goal; surfaces in the iteration log. |
| `payload` | `GenerateMenuInput` | The full, engine-ready input (the actual context). |
| `meta.createdBy` | `string` | Provenance (e.g. `"experiment"`, a user id). |
| `meta.note` | `string?` | Optional free-text note. |

### `payload: GenerateMenuInput` (the engine contract)

Mirrors [`packages/constraint-engine/src/types.ts`](../../constraint-engine/src/types.ts). Key
tunables the refine loop edits live under `options`:

| Field | Type | Notes |
|---|---|---|
| `workspace` | `WorkspaceSnapshot` | `id`, `type`, `name`, optional `sharedMealFrequency`. |
| `members` | `MemberSnapshot[]` | Per-member age/calorie/frequency + `dietaryRestrictions`, `allergies`, `ingredientDislikes`. |
| `recipes` | `RecipeSnapshot[]` | Each carries `mealType`, `dietaryTags`, `ingredients`, `servings`. |
| `ingredients` | `IngredientSnapshot[]` | Allergen map source; may be empty. |
| `weekStartDate` | `string` (ISO date) | Engine derives day-of-week. |
| `seed` | `number` | Seeds the engine RNG → determinism. |
| `options.additionalDietaryRestrictions` | `string[]?` | **Required tags** — a recipe missing any is filtered out. The over-constraint the demo scenario starts with. |
| `options.additionalAllergies` | `string[]?` | Hard allergen overlay. |
| `options.ingredientExclusions` | `string[]?` | Excluded ingredient ids. |
| `options.preferredCuisines` | `string[]?` | Soft preference. |
| `options.memberFrequencyOverrides` | `[]?` | Per-member frequency override. |
| `durationDays` | `number?` | 1..7, default 7. |
| `now` | `string?` | ISO timestamp; filters past slots. |

## Verb messages

| Verb | Args | Result |
|---|---|---|
| `sendContext` | `{ context: ContextEnvelope }` | `{ contextRef, contextHash, state }` |
| `requestAction` | `{ contextRef, action: "generate_menu", seedOverride? }` | `{ actionRef, contextRef, state }` |
| `receiveResult` | `{ actionRef }` | `{ actionRef, contextRef, result: GenerateMenuResult, verify: VerifyVerdict, state }` |
| `confirm` | `{ actionRef }` | `{ acceptedRef, actionRef, acceptedSeed, state }` |
| `rollback` | `{ reason? }` | `{ state, restoredContextRef, discardedActionRef, reason }` |

### `VerifyVerdict`

```ts
{ green: boolean; totalSlots: number; filledSlots: number; unfilledSlots: number; failures: string[] }
```

`green` is the pass/fail signal the verify→refine loop turns on. `failures` carries
`generation_failed:<constraint>` + the engine reason code on a failed generation, or
`unfilled_slots:<n>` when a result is partial.

### State machine

```
idle ──sendContext──▶ context_set ──requestAction──▶ result_ready
                          ▲                              │
                          │                      ┌───────┴────────┐
                          └──────rollback─────── │                │
                                              confirm          rollback
                                                 │                │
                                                 ▼                ▼
                                             confirmed       context_set
```

`requestAction` only runs against the **current** context; a superseded `contextRef` is rejected
with `ProtocolError("stale_context")`. `confirm` refuses a failed generation
(`ProtocolError("cannot_confirm_failed")`).

## Content addressing

`hashContext(envelope) = sha256(canonicalJson(envelope))`, where `canonicalJson` recursively sorts
object keys (arrays keep order — slot order is semantic). Two byte-equal contexts therefore hash
identically, and the hash is stable across a JSON round-trip — the property the
[`schema.test.ts`](../src/__tests__/schema.test.ts) round-trip suite locks.

`confirm` additionally computes `acceptedSeed = sha256(inputsHash + canonicalJson(sorted slot
recipe-tuples))`, mirroring the product's `accepted_seed`
([`apps/web/lib/api/menu-accept.ts`](../../../apps/web/lib/api/menu-accept.ts)).
