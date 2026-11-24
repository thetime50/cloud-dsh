import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createIncident, resolveComponentId, resolveIncident } from './flashduty.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(__dirname, 'config.js')
const statePath = path.join(__dirname, '.state.json')

if (!fs.existsSync(configPath)) {
  console.error(`缺少 ${configPath}，请复制 config.example.js 为 config.js 并填写密钥`)
  process.exit(1)
}

const { default: config } = await import(pathToFileURL(configPath).href)

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    return { ok: true, changeId: null }
  }
}

function saveState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 */
async function probe(url, timeoutMs) {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'cloud-dsh-status-observer/0.1' },
    })
    const text = await res.text()
    return { status: res.status, text, ms: Date.now() - started, error: null }
  } catch (error) {
    return {
      status: 0,
      text: '',
      ms: Date.now() - started,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * @param {typeof config} cfg
 */
async function runOnce(cfg, componentId, state) {
  /** @type {string[]} */
  const alerts = []
  for (const item of cfg.testRequests || []) {
    const ctx = await probe(item.url, cfg.timeoutMs || 10_000)
    console.log(`[probe] ${item.url} status=${ctx.status} ms=${ctx.ms}${ctx.error ? ` err=${ctx.error.message}` : ''}`)
    for (const check of item.checks || []) {
      const result = await check(ctx)
      if (!result || result.ok !== true) {
        alerts.push(result?.message || '检查失败')
      }
    }
  }

  const ok = alerts.length === 0
  const message = ok ? '探测正常' : alerts.join('；')

  if (!ok && state.ok) {
    const title = `${cfg.statusName}: 探测失败`
    const changeId = await createIncident({
      apiBase: cfg.apiBase,
      statusKey: cfg.statusKey,
      pageId: cfg.pageId,
      componentId,
      title,
      description: message,
      notifySubscribers: Boolean(cfg.notifySubscribers),
    })
    state = { ok: false, changeId }
    saveState(state)
    console.log(`[status] 已开故障 change_id=${changeId} — ${message}`)
    return state
  }

  if (ok && !state.ok && state.changeId) {
    await resolveIncident({
      apiBase: cfg.apiBase,
      statusKey: cfg.statusKey,
      pageId: cfg.pageId,
      changeId: state.changeId,
      componentId,
      description: message,
    })
    state = { ok: true, changeId: null }
    saveState(state)
    console.log(`[status] 已恢复 — ${message}`)
    return state
  }

  if (!ok && !state.ok) {
    console.log(`[status] 故障持续 — ${message}`)
  } else {
    console.log(`[status] 正常`)
  }
  state = { ...state, ok }
  saveState(state)
  return state
}

const componentId = await resolveComponentId(
  config.apiBase,
  config.statusKey,
  config.pageId,
  config.statusName,
)
console.log(`[boot] page=${config.pageId} component=${config.statusName} id=${componentId}`)

let state = loadState()
const tick = async () => {
  try {
    state = await runOnce(config, componentId, state)
  } catch (error) {
    console.error(`[error] ${error instanceof Error ? error.message : String(error)}`)
  }
}

await tick()
if (process.argv.includes('--once')) process.exit(0)
setInterval(tick, config.intervalMs || 120_000)
