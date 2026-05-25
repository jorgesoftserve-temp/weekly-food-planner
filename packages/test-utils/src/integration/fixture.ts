import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const INTEGRATION_ENABLED =
  Boolean(process.env.SUPABASE_TEST_URL) &&
  Boolean(process.env.SUPABASE_TEST_SERVICE_KEY)

export type IntegrationFixture = {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  cleanup: () => Promise<void>
}

const randomEmail = (): string =>
  `wfp-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`

const createServiceClient = (): SupabaseClient => {
  const url = process.env.SUPABASE_TEST_URL
  const key = process.env.SUPABASE_TEST_SERVICE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY required')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const createIntegrationFixture = async (): Promise<IntegrationFixture> => {
  const supabase = createServiceClient()
  const email = randomEmail()
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: 'test-password-1234',
    email_confirm: true,
  })
  if (createErr || !created.user) {
    throw new Error(
      `failed to create test user: ${createErr?.message ?? 'no user returned'}`,
    )
  }
  const userId = created.user.id
  const { data: workspaceRow, error: wsErr } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (wsErr || !workspaceRow) {
    await supabase.auth.admin.deleteUser(userId)
    throw new Error(
      `signup trigger did not create a workspace: ${wsErr?.message ?? 'no row'}`,
    )
  }
  const workspaceId = (workspaceRow as { id: string }).id
  const cleanup = async (): Promise<void> => {
    await supabase.auth.admin.deleteUser(userId)
  }
  return { supabase, userId, workspaceId, cleanup }
}
