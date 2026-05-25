# Step 15 — CSV export to close the format gap reserved in step 13

## Prompt used

See [/prompts/15-add-csv-export.txt](../prompts/15-add-csv-export.txt).

Summary: step 13 implemented the markdown export endpoint with `SUPPORTED_FORMATS = new Set(['markdown'])` and deferred CSV as a follow-up. The project deliverable language mentions "CSV/Markdown" so we close the gap here: add `renderMenuExportCsv` alongside the existing markdown renderer, branch on `?format=csv` in the route, and bring test coverage to parity.

## Context files provided

- [apps/web/lib/api/menu-export.ts](../apps/web/lib/api/menu-export.ts) — markdown renderer + `ExportInput` type shape.
- [apps/web/app/api/workspaces/[id]/export/route.ts](../apps/web/app/api/workspaces/%5Bid%5D/export/route.ts) — existing route handler with the format gate.
- [apps/web/lib/api/__tests__/menu-export.test.ts](../apps/web/lib/api/__tests__/menu-export.test.ts) — 10 markdown tests to mirror.
- [agent-log/13-export-endpoint-and-end-to-end-determinism.md](./13-export-endpoint-and-end-to-end-determinism.md) — the prior cycle's design notes, including the explicit "CSV deferred, intentionally" entry under Observed issue.

## Expected output

### A — `renderMenuExportCsv` in [apps/web/lib/api/menu-export.ts](../apps/web/lib/api/menu-export.ts)

Pure function, same `ExportInput` shape as the markdown renderer so the loader and the route stay format-agnostic. Output layout:

```
# Weekly Menu — <workspace>
# Workspace,<workspace>
# Week starting,<YYYY-MM-DD>
# Generated,<ISO timestamp>
# Seed,<number>
# Inputs hash,<sha256>

## Menu
Day,Meal,Recipe,Target
Monday,breakfast,Oatmeal,Alice
...

## Grocery list
Section,Ingredient,Quantity,Unit,Scheduled day
Shared,Oats,3.5,cup,Monday
Shared,Tomato,4,piece,
Per member: Alice,Apple,1,piece,Tuesday
```

Design choices:

- **Single rectangle, not a zip.** Step 13's design note framed the trade-off as "zip of two files vs. sentinel sections". Picked sentinel sections so the endpoint stays a single-file download with one content-type. Excel, Sheets, and pandas (`comment='#'`) all handle this without configuration.
- **`Section` column for grocery rows** (`Shared`, `Per member: Alice`) keeps the grocery payload a single rectangle instead of multiple `### sub-headings` like the markdown — pivot-table friendly.
- **RFC 4180 escaping**: a small `csvField` helper wraps fields containing `,`, `"`, `\r`, or `\n` in double quotes and doubles any inner `"`. Applied to every value emitted in a data row, including the `# Inputs hash,<value>` comment row (hash itself can't contain commas today, but the helper is the safety net so a future schema change won't silently break parsers).
- **Empty scheduled day → empty cell** (markdown uses `—`). Empty is the natural CSV convention and works with Excel's "blank cell" semantics.
- **Sort order identical to markdown**: day ordinal → mealKey → targetMemberId for slots; shared-first then per-member alphabetical for grocery lists; ingredient name alphabetical for grocery items. Determinism guarantee from step 13 holds for both formats.
- **No UTF-8 BOM.** Adding `﻿` would make Excel auto-detect UTF-8 for non-ASCII names, but it surprises pandas and shells that don't strip it. Skipped; documented here so the choice can be reversed if the user-facing case demands it.
- **`\n` line endings, not `\r\n`.** Matches the markdown renderer for consistency; modern spreadsheet tools accept either.

### B — Route handler in [apps/web/app/api/workspaces/[id]/export/route.ts](../apps/web/app/api/workspaces/%5Bid%5D/export/route.ts)

- Introduced an `ExportFormat = 'markdown' | 'csv'` union and a `FORMAT_CONFIG` lookup keyed by it, holding the per-format `contentType` and file extension (`md` / `csv`).
- Added `isSupportedFormat` user-defined type guard so the union narrows after the `400 Bad Request` branch — no string casts in the handler.
- Branches the renderer call on `format === 'csv'`, leaves the loader call (DB hits + name lookups) untouched — the same in-memory `ExportInput` feeds both renderers.
- Filename pattern stays `menu-<weekStartDate>.<ext>`; `content-disposition: attachment` so browsers trigger a save dialog.

### C — Test parity in [apps/web/lib/api/__tests__/menu-export.test.ts](../apps/web/lib/api/__tests__/menu-export.test.ts)

11 new CSV tests across two `describe` blocks (the existing 10 markdown tests untouched):

1. Header comment rows carry workspace / week / generated / seed / inputs hash.
2. Menu section header + sorted rows (day → mealKey).
3. Grocery rectangle uses the `Section` column + items sorted alphabetically.
4. Empty cell for null `scheduledPurchaseDay`; capitalised day when present.
5. Identical input → identical output (determinism).
6. Stable under input reordering (sort-driven, not insertion-driven).
7. `[unknown:id]` fallback when a name lookup misses.
8. Empty grocery list emits only the header row, no `Shared,` / `Per member:` rows.
9. Shared rows listed before per-member rows.
10. RFC 4180 escaping for commas, double-quotes, and embedded newlines across workspace name, recipe name, ingredient name.
11. `# Inputs hash` comment row is quoted if the hash itself contains a comma (defensive — exercises the comment-row escaping path).

### D — Verification

```
pnpm turbo run typecheck test
# 8 tasks, 8 successful
# constraint-engine: 31 passing
# supabase: 17 mocked passing, 5 integration skipped
# apps/web: 28 passing (10 markdown + 11 CSV + 7 menu-overlay), 3 integration skipped
# total: 76 passing, 8 skipped
```

Up from 65 / 8 at the close of step 14.

## Observed issue

- **CSV is not strictly machine-friendly because of the `#` comment rows.** Excel and Sheets render the `#` rows as data; pandas can ignore them with `pd.read_csv(path, comment='#', skip_blank_lines=True)` but `csv.reader` in stdlib will not. The trade-off is the same as the markdown renderer (one self-describing document vs. two files); the alternative — putting workspace metadata in HTTP headers and the CSV as a pure rectangle — was rejected because most users will save the file and lose the context. Documented here so a downstream consumer that needs strict CSV knows to filter `^#` lines.
- **Quantity rounding is shared with the markdown renderer** (`Math.round(n * 1000) / 1000`) so the same `3.5` shows up in both. The shared helper would normally argue for extraction, but the simplify-skill guidance "three similar lines is better than a premature abstraction" applies — both renderers are small, the sort logic is also duplicated, and refactoring would broaden the diff in a step that should stay tightly scoped to "add CSV."
- **No Bruno collection update.** The existing `Export menu + grocery (markdown)` request in [scripts/weekly-food-planner-bruno.json](../scripts/weekly-food-planner-bruno.json) is one query-string flip (`?format=markdown` → `?format=csv`) away from exercising the new path. Adding a duplicate request would be code churn for a one-character change; mentioned in follow-ups.
- **Integration test untouched.** [apps/web/integration/end-to-end.integration.test.ts](../apps/web/integration/end-to-end.integration.test.ts) drives the markdown renderer end-to-end. The CSV path is unit-tested but not yet exercised in the integration suite — could be a one-line addition (`renderMenuExportCsv(exported.export)`) but would not catch anything the unit tests miss because the loader is format-agnostic. Left as a follow-up so the integration suite stays focused on the engine pipeline.
- **No CSV-specific failure modes.** The route already returns `400` for unsupported `format`, `404` for missing workspace, `412` for no active menu, `500` for DB errors. CSV doesn't add a new failure surface — it's a pure renderer over already-loaded data.

## Follow-up fixes

- After this commit lands and CI passes, update the badge run history once `https://github.com/jorgesoftserve-temp/weekly-food-planner/actions` shows the green run.
- Add a `?format=csv` request to [scripts/weekly-food-planner-bruno.json](../scripts/weekly-food-planner-bruno.json) under the "4. Menus & grocery" folder so the collection covers both formats explicitly.
- If a downstream consumer needs strict CSV, add a `?strict=1` (or `?profile=strict-csv`) query param that suppresses the `#` comment rows. Easy drop-in; not building it now because no consumer needs it yet.
- Carried forward from step 14 (none of these block further work):
  - Engine soft-constraint scoring + local-search refinement per [ARCHITECTURE_PRD §6.1](../docs/PRD/ARCHITECTURE_PRD.md).
  - Per-member grocery splits + freshness-aware `scheduled_purchase_day` scheduling.
  - "Untagged allergen is silently skipped" engine test branch (from log 06).
  - `(raw_input_with_duplicates, deduped_equivalent)` overlay fixture pair (from log 08).
  - Wire `pnpm test:integration` into CI behind a Supabase-secrets job guard.
