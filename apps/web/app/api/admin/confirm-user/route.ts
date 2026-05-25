import { type NextRequest } from 'next/server'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import { isValidAdminKey } from '@/lib/api/admin-key'
import {
  badRequest,
  forbidden,
  jsonOk,
  notFound,
  serverError,
} from '@/lib/api/responses'

// Local-dev / Postman helper: marks a user's email as confirmed without
// requiring them to click the verification link. NEVER deploy to production.
export const POST = async (request: NextRequest) => {
  if (!isValidAdminKey({ request })) return forbidden()

  const body = (await request.json().catch(() => null)) as { email?: string } | null
  if (!body?.email) return badRequest('email is required')

  const admin = supabaseAdminClient()
  const { data: usersList, error: listErr } = await admin.auth.admin.listUsers()

  console.log(listErr)
  if (listErr) return serverError(listErr.message)

  const target = usersList.users.find((u) => u.email === body.email)
  if (!target) return notFound()

  const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(
    target.id,
    { email_confirm: true },
  )
  if (updErr || !updated.user) return serverError(updErr?.message ?? 'update failed')

  return jsonOk({ userId: updated.user.id, email: updated.user.email })
}
