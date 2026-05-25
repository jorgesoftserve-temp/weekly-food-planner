# Step 02 — Apply planned changes; write architecture + database PRDs

## Prompt used

See [/prompts/02-apply-changes-write-architecture-database.txt](../prompts/02-apply-changes-write-architecture-database.txt).

Summary: write the full architecture and database PRDs incorporating five clarifications from the user — concrete values for undefined enums, JSONB shape for `meal_frequency`, Next.js (drop Express), role model (`creator`, `admin`, `member`), and an `enum_metadata`-style extension table so enums can be searchable and user-suggestable.

## Context files provided

- All PRDs in their post-step-01 state.
- `.cursor/rules/global-rules.md` (especially the SQL migration style guide and the Supabase client conventions).

## Expected output

- Full content for `docs/ARQUITECTURE_PRD.md`, written from scratch.
- Full content for `docs/DATABASE_PRD.md`, written from scratch.
- Surgical edit to `docs/PRODUCT_PRD.md` adding `## 2.1 Roles`, `## 2.2 Member profile fields`, and `## 2.3 Meal frequency` (with the child example).
- Rewrite of `docs/TECHNICAL_PRD.md`: drop Express, unify backend + frontend on Next.js, fix repo structure, switch testing to Vitest to align with cursor rules.
- A "gap analysis" section closing the response, surfacing blockers and important items still unresolved.

## Observed issue

- Two PRDs needed full content; the rest needed targeted edits. Mixed `Write` (new content) with `Edit` (surgical) accordingly.
- Switching from Jest to Vitest was a deliberate divergence from the original Technical PRD wording — flagged in the response so the user could veto.
- The architecture file retained its Spanish spelling (`ARQUITECTURE_PRD.md`) at this step pending an explicit user decision; the doc body uses "Architecture" and a top-of-file note explained the mismatch.
- Multiple gaps surfaced for step 03: recipe calorie data (calorie balancing was unimplementable without `calories_per_serving`); no group invitation flow; constraint-engine algorithm choice not committed; timezone semantics for `meal_frequency.default_hour`; shared vs. member-specific slot policy; auth completeness (email verification, password reset); recipe media (images); allergy free-text fallback; empty-state UX; first-time-user seed recipes; Vitest vs. Jest; and several smaller items.

## Follow-up fixes

- All gaps surfaced in a structured response (Blocking / Important / Defer-OK / Doc hygiene) so the user could resolve them in the next prompt.
- No premature implementation — each unresolved item became either a follow-up prompt input or an "Open questions" entry in the relevant doc.
