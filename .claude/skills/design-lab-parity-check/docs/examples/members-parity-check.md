# Worked example — design-lab-parity-check on the Members screen

Input the skill received:

> Run a parity check on the Members screen. Frame key `members`, live route `/members`. Dev server at `http://127.0.0.1:3000`.

Below is the evidence report the skill produces. It is **capture + tabulation only** — the verdict
is left to `design-parity-auditor`. Annotations in `> blockquotes` explain the choices; they are not
part of the emitted report.

---

## Parity evidence — members (frame key: members) → /members

### Capture status
- Base URL: `http://127.0.0.1:3000` — reachable.
- Lab mock: `/design-lab/frame?screen=members&dark=0|1` — no auth, captured all 6 combos.
- Live route `/members` — required auth; signed-in session with a seeded workspace present, captured all 6 combos.
- **All 12 captures obtained** (mock + live × 390/820/1440 × light/dark).

> If the live route had bounced to `/login`, the skill would stop here and report it — never
> screenshot the login page and call it "members".

### Token usage (live source — `apps/web/app/(app)/members/_components/member-card.tsx`)
| Promoted token | Expected (cozy spec) | Present in live? | Notes |
|---|---|---|---|
| card radius | `rounded-2xl` | yes | [member-card.tsx:18](../../../../../apps/web/app/(app)/members/_components/member-card.tsx#L18) |
| shadow scale | soft warm `shadow-md` | **no** | uses default `shadow-sm`; reads flatter than mock |
| member accent ring | `--user-accent*` token | yes | ring via `style` is the allowed per-member carve-out |
| success/warning chips | `bg-success-tint` / `text-success` | yes | role badge uses `success` token |
| inline color/radii leak | none | **1 found** | `bg-[#fb4b66]` at [member-card.tsx:42](../../../../../apps/web/app/(app)/members/_components/member-card.tsx#L42) — brand hardcoded instead of `bg-primary` |

> The skill records the leak; it does not fix it. The accent ring `style={...}` is NOT flagged —
> it's the documented per-member carve-out through the `--user-accent*` family.

### Structural inventory (mock vs live)
| Element / section | In mock | In live | Delta kind | Candidate |
|---|---|---|---|---|
| "Household members" heading | yes | yes | — | ok |
| Member card grid | yes | yes | — | ok |
| Loading skeleton | no | yes | structural | likely-acceptable (live-only state) |
| Empty state ("Add your first member") | no | yes | structural | likely-acceptable (live-only state) |
| "Add member" button | yes | yes | — | ok |
| Per-member meal-frequency chip | yes | **no** | structural | likely-regression |

> Skeleton + empty state are live-only and expected → `likely-acceptable`. The missing frequency
> chip existed in the mock and is gone live → `likely-regression`, for the auditor to confirm.

### Per-viewport × theme notes
- **390 light** — cards reflow to a single column, no horizontal scroll. ✓ Add-member is a full-width button (mock matches).
- **390 dark** — same reflow; dark tokens render; accent ring visible on each card.
- **820 light** — 2-column grid (mock intent), gap reads tighter than the mock's roomy spacing.
- **820 dark** — 2-column; no theme-only anomalies.
- **1440 light** — 3-column grid matches mock; card depth reads flatter (see `shadow-sm` token note).
- **1440 dark** — 3-column; gradient wash present.

### Console (live)
- Clean — no hydration, image, or fetch errors.

### Hand-off
Evidence ready for `design-parity-auditor` to verdict. Likely-regression candidates to adjudicate:
(1) card `shadow-sm` vs required soft `shadow-md`, (2) `bg-[#fb4b66]` inline leak → should be
`bg-primary`, (3) missing per-member meal-frequency chip, (4) 820px gap tighter than mock.
Open questions: is the frequency chip an intentional deferral or a drop?
