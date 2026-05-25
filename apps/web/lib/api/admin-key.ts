import type { NextRequest } from 'next/server'

// Shared-secret check for /api/admin/* endpoints. Local-dev / Postman use only.
export const isValidAdminKey = ({ request }: { request: NextRequest }): boolean => {
  const expected = process.env.ADMIN_API_KEY
  if (!expected) return false
  const provided = request.headers.get('x-admin-key')
  return provided === expected
}
