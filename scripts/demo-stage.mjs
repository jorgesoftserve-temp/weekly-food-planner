// One-shot staging for the demo recording. Run this between the UI signup
// and the UI login (Beat 2 of docs/demo/demo-script.md):
//
//   node scripts/demo-stage.mjs <email> <password>
//
// It does three things, all of which would otherwise require terminal/curl
// gymnastics on camera — the workspace-settings and member-management UIs
// were scope-cut in agent-log/16:
//
//   1. Confirms the email via /api/admin/confirm-user (skips the email link)
//   2. Sets the workspace's shared_meal_frequency to breakfast + dinner
//      (the signup trigger leaves this null — see the NO_SLOTS note in
//      agent-log/18)
//   3. Marks the creator member as vegetarian via the
//      member dietary-restrictions PUT endpoint
//
// Idempotent up to the email-confirm step — re-running with the same email
// after step 1 is fine, the workspace and member updates are upserts.

const SUPABASE_URL = 'http://127.0.0.1:54321'
const APP_URL = 'http://127.0.0.1:3000'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const ADMIN_KEY = 'admin_key'

const log = (...args) => console.log('[demo-stage]', ...args)
const fail = (msg) => {
  console.error('[demo-stage] FAIL:', msg)
  process.exit(1)
}

const [, , emailArg, passwordArg] = process.argv
if (!emailArg || !passwordArg) {
  fail('usage: node scripts/demo-stage.mjs <email> <password>')
}

// Build the cookie shape @supabase/ssr v0.5 expects. Same pattern as
// scripts/verify-flow.mjs — see that file for the full rationale.
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
  log('email:', emailArg)

  // 1. Confirm via admin endpoint (no email click).
  const confirmRes = await fetch(`${APP_URL}/api/admin/confirm-user`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify({ email: emailArg }),
  })
  if (!confirmRes.ok) {
    fail(`confirm-user ${confirmRes.status}: ${await confirmRes.text()}`)
  }
  log('email confirmed')

  // 2. Sign in to obtain the session we'll use for the subsequent API hits.
  // The web app's login flow will also sign in via the browser; this is a
  // parallel session purely for the staging API calls.
  const signinRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ email: emailArg, password: passwordArg }),
    },
  )
  const session = await signinRes.json()
  if (!signinRes.ok || !session.access_token) {
    fail(`signin ${signinRes.status}: ${JSON.stringify(session)}`)
  }

  const cookieHeader = `sb-127-auth-token=${sessionCookieValue(session)}`
  const app = async (method, path, body) => {
    const res = await fetch(`${APP_URL}${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    })
    const ct = res.headers.get('content-type') ?? ''
    const out = ct.includes('json') ? await res.json() : await res.text()
    return { status: res.status, body: out }
  }

  // 3. Pull /api/me to find the workspace + creator member.
  const me = await app('GET', '/api/me')
  if (me.status !== 200) fail(`/api/me ${me.status}: ${JSON.stringify(me.body)}`)
  const workspaceId =
    me.body.workspaces?.[0]?.workspace?.id ??
    me.body.workspaces?.[0]?.workspace_id
  if (!workspaceId) fail(`no workspace in /api/me response: ${JSON.stringify(me.body)}`)
  log('workspace:', workspaceId)

  // 4. Set shared_meal_frequency = breakfast + dinner.
  // Without this, menu generation returns 422 NO_SLOTS.
  const freqRes = await app('PATCH', `/api/workspaces/${workspaceId}`, {
    shared_meal_frequency: [
      { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 8 },
      { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 18 },
    ],
  })
  if (freqRes.status < 200 || freqRes.status >= 300) {
    fail(`PATCH workspace ${freqRes.status}: ${JSON.stringify(freqRes.body)}`)
  }
  log('meal frequency set: breakfast + dinner')

  // 5. Find the creator member (the user who just signed up) and mark them
  // vegetarian. The signup trigger inserts exactly one member with
  // role='creator' for individual workspaces.
  const members = await app(
    'GET',
    `/api/workspaces/${workspaceId}/members`,
  )
  if (members.status !== 200) {
    fail(`GET members ${members.status}: ${JSON.stringify(members.body)}`)
  }
  const list = Array.isArray(members.body) ? members.body : members.body?.members ?? []
  const creator = list.find((m) => m.role === 'creator') ?? list[0]
  if (!creator?.id) fail(`no creator member found in workspace ${workspaceId}`)

  const restrictRes = await app(
    'PUT',
    `/api/workspaces/${workspaceId}/members/${creator.id}/dietary-restrictions`,
    { values: ['vegetarian'] },
  )
  if (restrictRes.status !== 200) {
    fail(`PUT dietary-restrictions ${restrictRes.status}: ${JSON.stringify(restrictRes.body)}`)
  }
  log('creator member marked vegetarian')

  log('all set — switch back to the browser and log in')
}

main().catch((err) => {
  console.error('[demo-stage] UNCAUGHT:', err)
  process.exit(1)
})
