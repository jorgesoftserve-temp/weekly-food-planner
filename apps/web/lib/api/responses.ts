export const jsonOk = <T>(data: T, init?: ResponseInit): Response => {
  return Response.json(data, init)
}

export const jsonError = (
  status: number,
  error: string,
  detail?: string,
): Response => {
  const body = detail !== undefined ? { error, detail } : { error }
  return Response.json(body, { status })
}

export const unauthorized = (): Response => jsonError(401, 'unauthorized')
export const forbidden = (): Response => jsonError(403, 'forbidden')
export const notFound = (): Response => jsonError(404, 'not_found')
export const conflict = (detail: string): Response => jsonError(409, 'conflict', detail)
export const badRequest = (detail: string): Response => jsonError(400, 'bad_request', detail)
export const serverError = (detail: string): Response => jsonError(500, 'server_error', detail)
