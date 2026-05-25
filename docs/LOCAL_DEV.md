# Local development & API testing

The fastest path from a fresh clone to a working API + Postman flow.

## Prerequisites

- Node 20+ (the repo is tested on Node 26).
- Docker Desktop (or Docker Engine) running.
- Supabase CLI (`supabase --version` should print 2.x).
- pnpm — install via `npm install -g pnpm@9.12.3` if you don't have it.

## 1. Install dependencies

```sh
pnpm install
```

## 2. Start the local Supabase stack

```sh
cd packages/supabase
pnpm db:start
```

First run downloads several Docker images (~1–2 GB) and applies all 37 migrations. Subsequent runs are fast.

Print the local URLs and keys:

```sh
pnpm db:status
```

You'll see the API URL, anon key, service-role key, Studio URL, and Inbucket (local mail) URL.

## 3. Configure `apps/web/.env.local`

Copy the template and paste in the values you got from `db:status`:

```sh
cd ../../apps/web
cp .env.example .env.local
```

Then edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
ADMIN_API_KEY=change-me-please
```

`ADMIN_API_KEY` is a shared secret for the `/api/admin/*` test endpoints — set it to anything memorable and use the same value in Postman.

## 4. Start the Next.js dev server

From the project root:

```sh
pnpm dev
```

The app boots at `http://127.0.0.1:3000`. The auth pages at `/login` and `/signup` work in a browser, but for API testing we drive everything via Postman.

## 5. Import the Postman collection

In Postman: **File → Import →** select `postman/weekly-food-planner.postman_collection.json`.

Open the collection's **Variables** tab and fill in:

- `supabase_anon_key` — paste the same anon key you put in `.env.local`.
- `admin_key` — paste the same value you set for `ADMIN_API_KEY`.

The other variables (`access_token`, `workspace_id`, `recipe_id`, `menu_id`, `oats_ingredient_id`) are populated automatically by the request test scripts as you run them.

## 6. Run the API flow

Run the requests in order, top to bottom:

| Folder | Request | What it does |
|---|---|---|
| 1. Setup | Signup | Creates the test user in Supabase Auth |
| | Admin: Confirm user | Bypasses email verification via service-role |
| | Login | Stores the user's `access_token` |
| 2. Workspace & catalog | GET /api/me | Stores the individual `workspace_id` |
| | PATCH workspace | Sets the shared meal frequency (3 meals/day) |
| | Admin: Seed ingredients | Populates ~30 ingredients with allergen tags |
| | GET /api/ingredients | Stores `oats_ingredient_id` |
| | Admin: Seed recipes | Creates six starter recipes for the workspace |
| 3. Recipes | Create / List / Get / Update / Delete | Exercises CRUD on a custom recipe |
| 4. Menus & grocery | Generate menu | Runs the constraint engine and persists the menu |
| | Get active menu | Reads it back |
| | Get grocery list | Reads the aggregated grocery list |
| 5. Labels | Search dietary_tag / cuisine_type | Exercises the autocomplete endpoint |

## 7. Useful URLs while testing

- App: <http://127.0.0.1:3000>
- Supabase Studio (SQL + tables): <http://127.0.0.1:54323>
- Inbucket (local email inbox): <http://127.0.0.1:54324>
- Supabase API: <http://127.0.0.1:54321>

## 8. Reset state

```sh
cd packages/supabase
pnpm db:reset
```

Truncates the local DB and re-applies migrations. After this, re-run the Postman flow from `Signup` — the `seed-ingredients` and `seed-recipes` steps are idempotent / fresh-workspace friendly.

To stop the stack:

```sh
pnpm db:stop
```

## Notes

- The `/api/admin/*` endpoints are gated by the `x-admin-key` header (matched against `ADMIN_API_KEY`). They use the service-role client and bypass RLS. **Never deploy these to production as-is** — they exist to make local + Postman testing painless.
- Menu generation is deterministic. Calling **Generate menu** twice with the same `seed` produces an identical menu; the previous one is soft-deleted and the new one becomes active (`menus.is_deleted = true` for the old row).
- The overlay's `additionalDietaryRestrictions` / `additionalAllergies` go through silent dedup against current members' profiles — duplicates are quietly dropped and the persisted `menus.generation_options` reflects only the effective set.
