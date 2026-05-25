import { serverError } from './responses'

export const runWithErrorHandler = async (
  fn: () => Promise<Response>,
): Promise<Response> => {
  try {
    return await fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal error'
    return serverError(message)
  }
}
