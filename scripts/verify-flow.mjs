// One-off end-to-end driver for /verify. Signs up a fresh user, confirms it
// via the local admin endpoint, signs in, then walks recipe create -> edit
// (the new array PUTs) -> menu generate -> grocery -> markdown + CSV export.
// Logs each step's HTTP status + a small slice of the body.

const SUPABASE_URL = 'http://127.0.0.1:54321'
const APP_URL = 'http://127.0.0.1:3001'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const ADMIN_KEY = 'admin_key'

const log = (...args) => console.log('[verify]', ...args)
const fail = (msg) => {
  console.error('[verify] FAIL:', msg)
  process.exit(1)
}

// Build the cookie set that @supabase/ssr expects so the Next.js API routes
// (which call createServerClient + cookies.getAll) see an authenticated user.
// @supabase/ssr v0.5 stores the session as a single base64-prefixed cookie
// named `sb-<project-ref>-auth-token`. Project ref is derived from the URL.
const projectRefFor = (url) => {
  // Local supabase uses a fixed host (127.0.0.1:54321). The CLI sets the
  // project ref to "127" in the cookie name.
  if (url.includes('127.0.0.1') || url.includes('localhost')) return '127'
  const m = new URL(url).hostname.match(/^([^.]+)\./)
  return m ? m[1] : 'default'
}

const sessionCookieValue = (session) => {
  const payload = {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  }
  return 'base64-' + Buffer.from(JSON.stringify(payload)).toString('base64')
}

const main = async () => {
  const email = `verify-${Date.now()}@example.com`
  const password = 'testpassword123'
  log('email:', email)

  // 1. Sign up
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const signupJson = await signupRes.json()
  if (!signupRes.ok || !signupJson.id) fail(`signup ${signupRes.status}: ${JSON.stringify(signupJson)}`)
  log('signed up:', signupJson.id)

  // 2. Confirm via admin endpoint
  const confirmRes = await fetch(`${APP_URL}/api/admin/confirm-user`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify({ email }),
  })
  if (!confirmRes.ok) fail(`confirm ${confirmRes.status}: ${await confirmRes.text()}`)
  log('confirmed.')

  // 3. Sign in
  const signinRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
  )
  const session = await signinRes.json()
  if (!signinRes.ok || !session.access_token) fail(`signin ${signinRes.status}: ${JSON.stringify(session)}`)
  log('signed in. user id:', session.user.id)

  // 4. Build the cookie. The middleware reads cookies via @supabase/ssr; the
  // exact name varies with project ref. For local dev it's sb-127-auth-token.
  const projectRef = projectRefFor(SUPABASE_URL)
  const cookieName = `sb-${projectRef}-auth-token`
  const cookieValue = sessionCookieValue(session)
  const cookieHeader = `${cookieName}=${cookieValue}`
  log('cookie name:', cookieName, ' value len:', cookieValue.length)

  // Helper that hits the Next app with the session cookie.
  const app = async (method, path, body) => {
    const res = await fetch(`${APP_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    })
    let bodyOut
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('json')) bodyOut = await res.json()
    else bodyOut = (await res.text()).slice(0, 300)
    return { status: res.status, body: bodyOut, headers: res.headers }
  }

  // 5. /api/me — should now return user + workspaces (trigger created one)
  const me = await app('GET', '/api/me')
  log('GET /api/me ->', me.status, JSON.stringify(me.body).slice(0, 200))
  if (me.status !== 200) fail('/api/me did not return 200')
  const workspaceId = me.body.workspaces?.[0]?.workspace?.id ?? me.body.workspaces?.[0]?.workspace_id
  if (!workspaceId) fail('no workspace from /api/me')
  log('workspace id:', workspaceId)

  // 6. Seed ingredients (admin endpoint — needs x-admin-key)
  const seedRes = await fetch(`${APP_URL}/api/admin/seed-ingredients`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      cookie: cookieHeader,
    },
    body: '{}',
  })
  const seedBody = await seedRes.text()
  log(
    'POST /api/admin/seed-ingredients ->',
    seedRes.status,
    seedBody.slice(0, 200),
  )

  // 7. Pull the ingredient catalog
  const ingredients = await app('GET', '/api/ingredients')
  const ingredientsList = Array.isArray(ingredients.body)
    ? ingredients.body
    : ingredients.body?.ingredients ?? []
  log(
    'GET /api/ingredients ->',
    ingredients.status,
    'count:',
    ingredientsList.length,
    'shape:',
    Array.isArray(ingredients.body) ? 'array' : typeof ingredients.body,
  )
  if (ingredientsList.length === 0) fail('no ingredients')
  const oats = ingredientsList.find((i) => /oat/i.test(i.name)) ?? ingredientsList[0]
  const milk = ingredientsList.find((i) => /milk/i.test(i.name)) ?? ingredientsList[1]
  const tomato = ingredientsList.find((i) => /tomato/i.test(i.name)) ?? ingredientsList[2]
  log('using:', oats.name, milk?.name, tomato?.name)

  // 8. Create 3 recipes (one with dietary tags)
  const recipes = []
  for (const r of [
    {
      name: 'Oatmeal',
      meal_type: 'breakfast',
      difficulty: 'easy',
      servings: 1,
      ingredients: [
        { ingredient_id: oats.id, quantity: 0.5, unit: 'cup' },
        { ingredient_id: milk.id, quantity: 1, unit: 'cup' },
      ],
      dietary_tags: ['vegetarian'],
    },
    {
      name: 'Buttered toast',
      meal_type: 'breakfast',
      difficulty: 'easy',
      servings: 1,
      ingredients: [{ ingredient_id: milk.id, quantity: 0.25, unit: 'cup' }],
    },
    {
      name: 'Tomato salad',
      meal_type: 'lunch',
      difficulty: 'easy',
      servings: 1,
      ingredients: [{ ingredient_id: tomato.id, quantity: 2, unit: 'piece' }],
    },
    {
      name: 'Tomato pasta',
      meal_type: 'dinner',
      difficulty: 'easy',
      servings: 2,
      cuisine: 'italian',
      ingredients: [{ ingredient_id: tomato.id, quantity: 3, unit: 'piece' }],
      instructions: [
        { step_order: 1, description: 'Boil pasta' },
        { step_order: 2, description: 'Add tomato sauce' },
      ],
    },
  ]) {
    const created = await app('POST', `/api/workspaces/${workspaceId}/recipes`, r)
    log(`POST /recipes (${r.name}) ->`, created.status, JSON.stringify(created.body).slice(0, 120))
    if (created.status < 200 || created.status >= 300) fail(`recipe create failed: ${JSON.stringify(created.body)}`)
    recipes.push({ ...r, id: created.body.id })
  }

  // 9. List recipes
  const listRes = await app('GET', `/api/workspaces/${workspaceId}/recipes`)
  log(`GET /recipes ->`, listRes.status, 'count:', Array.isArray(listRes.body) ? listRes.body.length : '?')
  if (listRes.status !== 200 || (Array.isArray(listRes.body) && listRes.body.length < 4)) {
    fail('expected ≥4 recipes after creation')
  }

  // 10. Exercise the new b340ff7 array-replace endpoints on the first recipe
  const target = recipes[0]
  const newIngredients = [
    { ingredient_id: oats.id, quantity: 1, unit: 'cup' },
    { ingredient_id: milk.id, quantity: 2, unit: 'cup' },
    { ingredient_id: tomato.id, quantity: 1, unit: 'piece' },
  ]
  const ingPut = await app(
    'PUT',
    `/api/workspaces/${workspaceId}/recipes/${target.id}/ingredients`,
    { ingredients: newIngredients },
  )
  log(`PUT /ingredients ->`, ingPut.status, JSON.stringify(ingPut.body).slice(0, 200))
  if (ingPut.status !== 200) fail('PUT /ingredients failed')

  const instPut = await app(
    'PUT',
    `/api/workspaces/${workspaceId}/recipes/${target.id}/instructions`,
    {
      instructions: [
        { step_order: 1, description: 'Boil water and oats together' },
        { step_order: 2, description: 'Stir milk in slowly' },
      ],
    },
  )
  log(`PUT /instructions ->`, instPut.status, JSON.stringify(instPut.body).slice(0, 200))
  if (instPut.status !== 200) fail('PUT /instructions failed')

  const tagPut = await app(
    'PUT',
    `/api/workspaces/${workspaceId}/recipes/${target.id}/dietary-tags`,
    { tags: ['vegan', 'gluten_free'] },
  )
  log(`PUT /dietary-tags ->`, tagPut.status, JSON.stringify(tagPut.body).slice(0, 200))
  if (tagPut.status !== 200) fail('PUT /dietary-tags failed')

  // 11. Verify the recipe reflects the new arrays
  const after = await app(
    'GET',
    `/api/workspaces/${workspaceId}/recipes/${target.id}`,
  )
  log(
    `GET /recipes/${target.id} ->`,
    after.status,
    'ingredients:',
    after.body.recipe_ingredients?.length,
    'instructions:',
    after.body.recipe_instructions?.length,
    'tags:',
    after.body.recipe_dietary_tags?.map((t) => t.tag).join(','),
  )
  if (
    after.body.recipe_ingredients?.length !== 3 ||
    after.body.recipe_instructions?.length !== 2 ||
    !after.body.recipe_dietary_tags?.some((t) => t.tag === 'vegan')
  ) {
    fail('post-edit recipe state mismatch')
  }

  // 11b. The signup trigger creates a workspace with no shared_meal_frequency.
  // The engine needs at least one slot template before it can generate, so set
  // breakfast + lunch + dinner — matching both the 4 recipes' meal_types above
  // and the per-member default (adults default to breakfast+lunch+dinner via
  // fn_default_meal_frequency_for_age, so the creator member demands a lunch
  // slot). This is a fresh-workspace setup step the UI doesn't yet expose
  // (member-management screens were scope-cut in step 16).
  const setFreq = await app('PATCH', `/api/workspaces/${workspaceId}`, {
    shared_meal_frequency: [
      { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 8 },
      { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
      { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 18 },
    ],
  })
  log(`PATCH /workspaces (set meal frequency) ->`, setFreq.status, JSON.stringify(setFreq.body).slice(0, 200))
  if (setFreq.status < 200 || setFreq.status >= 300) fail('PATCH workspace failed')

  // 12. Generate a menu (next Monday)
  const today = new Date()
  const day = today.getDay()
  const offset = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  const monday = new Date(today)
  monday.setDate(monday.getDate() + offset)
  const weekStart = monday.toISOString().slice(0, 10)
  log('week_start_date:', weekStart)
  const genRes = await app(
    'POST',
    `/api/workspaces/${workspaceId}/menus`,
    { weekStartDate: weekStart },
  )
  log(`POST /menus ->`, genRes.status, JSON.stringify(genRes.body).slice(0, 250))
  if (genRes.status !== 200) fail('menu generation failed')

  // 12b. Accept the draft (generation produces a DRAFT under the draft → accept
  // lifecycle; only an accepted menu is "active" and drives the grocery list).
  const draftMenuId = genRes.body.menuId
  if (!draftMenuId) fail('generation did not return a menuId')
  const acceptRes = await app(
    'POST',
    `/api/workspaces/${workspaceId}/menus/${draftMenuId}/accept`,
  )
  log(`POST /menus/:id/accept ->`, acceptRes.status, JSON.stringify(acceptRes.body).slice(0, 150))
  if (acceptRes.status < 200 || acceptRes.status >= 300) fail('menu accept failed')

  // 13. Read the active menu
  const activeMenu = await app('GET', `/api/workspaces/${workspaceId}/menus/active`)
  log(`GET /menus/active ->`, activeMenu.status, 'slots:', activeMenu.body.menu_slots?.length)
  if (activeMenu.status !== 200 || !activeMenu.body.menu_slots?.length) fail('no active menu')

  // 14. Read the grocery list
  const grocery = await app('GET', `/api/workspaces/${workspaceId}/grocery`)
  log(
    `GET /grocery ->`,
    grocery.status,
    'lists:',
    grocery.body.lists?.length,
    'items:',
    grocery.body.lists?.[0]?.grocery_items?.length,
  )
  if (grocery.status !== 200 || !grocery.body.lists?.length) fail('no grocery list')

  // 15. Markdown export
  const mdRes = await fetch(
    `${APP_URL}/api/workspaces/${workspaceId}/export?format=markdown&week_start_date=${weekStart}`,
    { headers: { cookie: cookieHeader } },
  )
  const mdBody = await mdRes.text()
  log(
    'GET /export?format=markdown ->',
    mdRes.status,
    'content-type:',
    mdRes.headers.get('content-type'),
    'len:',
    mdBody.length,
    'has menu:',
    mdBody.includes('## Menu'),
    'has grocery:',
    mdBody.includes('## Grocery list'),
  )
  if (mdRes.status !== 200) fail('markdown export failed')

  // 16. CSV export
  const csvRes = await fetch(
    `${APP_URL}/api/workspaces/${workspaceId}/export?format=csv&week_start_date=${weekStart}`,
    { headers: { cookie: cookieHeader } },
  )
  const csvBody = await csvRes.text()
  log(
    'GET /export?format=csv ->',
    csvRes.status,
    'content-type:',
    csvRes.headers.get('content-type'),
    'len:',
    csvBody.length,
    'has menu:',
    csvBody.includes('## Menu'),
    'has grocery:',
    csvBody.includes('## Grocery list'),
  )
  if (csvRes.status !== 200) fail('csv export failed')

  log('=== ALL STEPS PASS ===')
}

main().catch((err) => {
  console.error('UNCAUGHT:', err)
  process.exit(1)
})
