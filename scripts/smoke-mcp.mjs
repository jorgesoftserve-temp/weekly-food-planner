#!/usr/bin/env node
// Smoke-test an MCP server declared in .mcp.json by performing the minimum
// stdio JSON-RPC handshake (initialize → initialized → tools/list) and printing
// the registered tool surface. Exits non-zero on any protocol or transport
// error.
//
// Usage:
//   node scripts/smoke-mcp.mjs <server-name>
//   node scripts/smoke-mcp.mjs --all
//
// Reads the server config from .mcp.json at repo root. Substitutes
// ${VAR} / ${VAR:-default} placeholders in args + env from process.env.

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const MCP_CONFIG_PATH = resolve(REPO_ROOT, '.mcp.json')

const INTERPOLATE = (raw, env) => {
  if (typeof raw !== 'string') return raw
  return raw.replace(/\$\{([^}]+)\}/g, (_, body) => {
    const [name, fallback] = body.split(/:-(.+)/, 2)
    const value = env[name]
    if (value !== undefined && value !== '') return value
    return fallback ?? ''
  })
}

const loadConfig = () => {
  const raw = readFileSync(MCP_CONFIG_PATH, 'utf8')
  return JSON.parse(raw)
}

const buildEnv = (serverEnv) => {
  const env = { ...process.env }
  for (const [key, val] of Object.entries(serverEnv ?? {})) {
    env[key] = INTERPOLATE(val, process.env)
  }
  return env
}

const buildArgs = (args) => (args ?? []).map((a) => INTERPOLATE(a, process.env))

const smoke = (serverName, cfg) => new Promise((res) => {
  const result = {
    server: serverName,
    ok: false,
    initialized: false,
    toolCount: 0,
    tools: [],
    serverInfo: null,
    error: null,
    stderrTail: '',
  }

  const args = buildArgs(cfg.args)
  const env = buildEnv(cfg.env)

  // On Windows, `npx` (and other .cmd shims) only resolves through a shell.
  // For real executables like `node`, shelling out re-tokenizes args and
  // mangles things like `--import tsx/esm`. So shell only for shim commands.
  const isShimCommand = /^(npx|pnpm|yarn|npm)(\.cmd)?$/i.test(cfg.command)
  const useShell = process.platform === 'win32' && isShimCommand

  const child = spawn(cfg.command, args, {
    cwd: REPO_ROOT,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: useShell,
  })

  const stderrChunks = []
  child.stderr.on('data', (c) => stderrChunks.push(c))

  let buf = ''
  const pending = new Map()
  let nextId = 1

  const sendRequest = (method, params) => new Promise((resolveRpc, rejectRpc) => {
    const id = nextId++
    pending.set(id, { resolveRpc, rejectRpc })
    const msg = { jsonrpc: '2.0', id, method, params }
    child.stdin.write(JSON.stringify(msg) + '\n')
  })

  const sendNotification = (method, params) => {
    const msg = { jsonrpc: '2.0', method, params }
    child.stdin.write(JSON.stringify(msg) + '\n')
  }

  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8')
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolveRpc, rejectRpc } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) rejectRpc(new Error(`${msg.error.code}: ${msg.error.message}`))
        else resolveRpc(msg.result)
      }
    }
  })

  let settled = false
  const settle = () => {
    if (settled) return
    settled = true
    result.stderrTail = Buffer.concat(stderrChunks).toString('utf8').slice(-800)
    try { child.kill() } catch {}
    res(result)
  }

  const timeoutMs = Number(process.env.MCP_SMOKE_TIMEOUT_MS ?? 60_000)
  const timeout = setTimeout(() => {
    if (!result.ok) result.error = result.error ?? `timeout (${Math.round(timeoutMs / 1000)}s)`
    settle()
  }, timeoutMs)

  child.on('error', (err) => {
    result.error = `spawn error: ${err.message}`
    clearTimeout(timeout)
    settle()
  })

  child.on('exit', (code, signal) => {
    if (!result.ok && !result.error) {
      result.error = `exited code=${code} signal=${signal} before handshake completed`
    }
    clearTimeout(timeout)
    settle()
  })

  ;(async () => {
    try {
      const init = await sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'smoke-mcp', version: '0.0.0' },
      })
      result.initialized = true
      result.serverInfo = init?.serverInfo ?? null
      sendNotification('notifications/initialized', {})
      const listed = await sendRequest('tools/list', {})
      const tools = Array.isArray(listed?.tools) ? listed.tools : []
      result.toolCount = tools.length
      result.tools = tools.map((t) => t.name)
      result.ok = true
      clearTimeout(timeout)
      settle()
    } catch (err) {
      result.error = err.message
      clearTimeout(timeout)
      settle()
    }
  })()
})

const main = async () => {
  const argv = process.argv.slice(2)
  if (argv.length === 0) {
    console.error('usage: node scripts/smoke-mcp.mjs <server-name|--all>')
    process.exit(2)
  }
  const cfg = loadConfig()
  const targets = argv.includes('--all')
    ? Object.keys(cfg.mcpServers)
    : argv
  let anyFailed = false
  for (const name of targets) {
    const serverCfg = cfg.mcpServers?.[name]
    if (!serverCfg) {
      console.error(`[${name}] not found in .mcp.json`)
      anyFailed = true
      continue
    }
    process.stdout.write(`[${name}] booting (${serverCfg.command} ${(serverCfg.args ?? []).join(' ')})\n`)
    const t0 = Date.now()
    const out = await smoke(name, serverCfg)
    const elapsed = Date.now() - t0
    if (out.ok) {
      const info = out.serverInfo
      console.log(
        `[${name}] OK ${elapsed}ms — server=${info?.name ?? '?'}@${info?.version ?? '?'} tools=${out.toolCount}`,
      )
      if (out.tools.length) console.log(`  tools: ${out.tools.join(', ')}`)
    } else {
      anyFailed = true
      console.log(`[${name}] FAIL ${elapsed}ms — ${out.error}`)
      if (out.stderrTail) console.log(`  stderr (last 800B):\n${out.stderrTail.split('\n').map((l) => '    ' + l).join('\n')}`)
    }
  }
  process.exit(anyFailed ? 1 : 0)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(2)
})
