# Step 01 — Review PRDs and plan architecture + database PRDs

## Prompt used

See [/prompts/01-review-prds-and-plan.txt](../prompts/01-review-prds-and-plan.txt).

Summary: read the existing PRDs without editing; produce an outline for the empty `ARQUITECTURE_PRD.md` and `DATABASE_PRD.md` so the user can review the structure before any writes happen.

## Context files provided

- `docs/OVERVIEW_PRD.md`
- `docs/PRODUCT_PRD.md`
- `docs/TECHNICAL_PRD.md`
- `docs/ARQUITECTURE_PRD.md` (empty stub — 1 line: `# Arquitcture PRD`)
- `docs/DATABASE_PRD.md` (empty stub — 1 line: `# Database PRD`)
- `.cursor/rules/global-rules.md`
- `README.md` (empty)

## Expected output

A planning response, with no file writes, covering:

- ARQUITECTURE_PRD section outline (purpose, drivers, topology, components, menu-generation pipeline, determinism, auth, API surface, frontend, testing, infra, observability, out-of-scope, open questions).
- DATABASE_PRD section outline (technology, conventions, entity overview, enumerations, per-table schema sketches, indexes, RLS, triggers, determinism support, freshness model, failure payload schema, migration ordering, open questions).
- A list of clarifying questions for the user before any docs are written.

## Observed issue

- `ARQUITECTURE_PRD.md` and `DATABASE_PRD.md` were empty stubs — no existing content to reconcile.
- `TECHNICAL_PRD.md` specified **Express** for the backend, which conflicts with the cursor rule expecting Supabase to be consumed directly from `apps/web/utils/supabase/` (i.e. Next.js as full-stack). Flagged as an open architectural question.
- The architecture filename used the Spanish spelling `ARQUITECTURE_PRD.md`; the doc body would use "Architecture" — needed user confirmation.
- Typos noticed across OVERVIEW (`memers`, `Proide`, `lits`, `Targer`, `mantain`, `generaiton`, `Arquitcture`) and PRODUCT (`Aviallable`, `Preffered`, `glutten-free`, `Freshnes`, trailing space in `Gluten-free `). Not fixed in this step — deferred to a later cleanup pass.
- OVERVIEW section numbering jumped from §6 to §8 (no §7).

## Follow-up fixes

- All edits explicitly deferred to step 02 per the user's instruction to plan only.
- Reconciliation items (Express vs. Next.js, role model, dietary taxonomy, ingredient catalog scope, `meal_frequency` shape, filename spelling) surfaced as a numbered list at the bottom of the planning response for the user to answer before writing began.
