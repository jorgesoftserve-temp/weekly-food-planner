import type { SupabaseClient, User } from '@supabase/supabase-js'

export type ChainStep = { method: string; args: unknown[] }

export type ChainResult = { data: unknown; error: unknown }

export type ChainConfig = {
  result?: ChainResult
  resultBySteps?: (steps: ChainStep[]) => ChainResult
}

type ChainAccumulator = { config: ChainConfig; steps: ChainStep[] }

const resolveResult = ({ config, steps }: ChainAccumulator): ChainResult => {
  if (config.resultBySteps) return config.resultBySteps(steps)
  return config.result ?? { data: null, error: null }
}

const makeChain = (acc: ChainAccumulator): unknown => {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled?: (value: ChainResult) => unknown) =>
          Promise.resolve(resolveResult(acc)).then(onFulfilled)
      }
      return (...args: unknown[]) =>
        makeChain({
          config: acc.config,
          steps: [...acc.steps, { method: String(prop), args }],
        })
    },
  }
  return new Proxy({}, handler)
}

export type SupabaseMockOptions = {
  user?: User | null
  authError?: { message: string } | null
  rpc?: Record<
    string,
    ChainResult | ((args: unknown) => ChainResult | Promise<ChainResult>)
  >
  from?: Record<string, ChainConfig>
  fromDefault?: ChainResult
}

export const createSupabaseMock = (
  opts: SupabaseMockOptions = {},
): SupabaseClient => {
  const fake = {
    auth: {
      getUser: async () => ({
        data: { user: opts.user ?? null },
        error: opts.authError ?? null,
      }),
    },
    rpc: async (name: string, args: unknown) => {
      const handler = opts.rpc?.[name]
      if (!handler) return { data: null, error: null }
      if (typeof handler === 'function') return handler(args)
      return handler
    },
    from: (table: string) => {
      const config: ChainConfig = opts.from?.[table] ?? {
        result: opts.fromDefault ?? { data: null, error: null },
      }
      return makeChain({ config, steps: [] })
    },
  }
  return fake as unknown as SupabaseClient
}
