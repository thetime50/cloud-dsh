import { spawn, type ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Config } from './config.ts'
import type { Db, InstanceRow } from './db.ts'
import { HttpError } from './errors.ts'
import { listMarketApps } from './market.ts'
import { killPid, pidAlive } from './proc.ts'

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export type Launcher = {
  create(id?: string, llmKey?: string): Promise<InstanceRow>
  start(id: string, llmKey?: string): Promise<InstanceRow>
  stop(id: string): Promise<InstanceRow>
  remove(id: string): Promise<InstanceRow>
  ensure(id: string, llmKey?: string): Promise<InstanceRow>
  list(): InstanceRow[]
  recover(): Promise<void>
  close(): void
}

function assertId(id: string): void {
  if (!ID_RE.test(id)) throw new HttpError(400, '实例 id 无效')
}

async function freePort(): Promise<number> {
  const net = await import('node:net')
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function waitHealthy(port: number, timeoutMs: number, isDead: () => boolean): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError = '无响应'
  while (Date.now() < deadline) {
    if (isDead()) throw new Error('进程已退出')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) })
      await response.arrayBuffer().catch(() => undefined)
      if (response.status > 0) return
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(lastError)
}

function writeStubProfile(profileDir: string, apps: { packageName: string, dir: string }[]): void {
  const webDir = path.join(profileDir, 'profiles', 'web')
  fs.mkdirSync(webDir, { recursive: true })
  const manifest = {
    name: 'dsh-profile-web',
    private: true,
    dependencies: Object.fromEntries(apps.map((app) => [app.packageName, `file:${app.dir}`])),
    dsh: {
      profile: {
        bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', ...apps.map((app) => app.packageName)],
      },
    },
  }
  fs.writeFileSync(path.join(webDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

async function installRealProfile(config: Config, profileDir: string, apps: { dir: string, packageName: string }[]): Promise<void> {
  const manifestPath = path.join(profileDir, 'profiles', 'web', 'package.json')
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      dsh?: { profile?: { bundles?: string[] } }
    }
    const bundles = manifest.dsh?.profile?.bundles || []
    if (apps.every((app) => bundles.includes(app.packageName))) return
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(config.dshBin, ['plugin', '--profile', 'web', 'add', ...apps.map((app) => app.dir)], {
      env: dshEnv(config, profileDir, '', ''),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `dsh plugin add 退出 ${code}`))
    })
  })
}

function dshEnv(config: Config, profileDir: string, instanceId: string, llmKey: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    LANG: process.env.LANG || 'C.UTF-8',
    DSH_HOME: profileDir,
    CLOUD_DSH_INSTANCE_ID: instanceId,
    CLOUD_DSH_DB: config.dbPath,
    CLOUD_DSH_SANDBOX_BIN: config.sandboxBin,
    CLOUD_DSH_SANDBOX_LOG: config.sandboxLog,
    CLOUD_DSH_SANDBOX_PATH: config.sandboxPath,
    CLOUD_DSH_RUNTIME: config.runtimeDir,
    CLOUD_DSH_UV: config.uvBin,
    DEEPSEEK_API_KEY: llmKey,
  }
  if (process.platform === 'win32') {
    env.SYSTEMROOT = process.env.SYSTEMROOT
    env.PATHEXT = process.env.PATHEXT
    env.COMSPEC = process.env.COMSPEC
    env.USERPROFILE = process.env.USERPROFILE
    env.APPDATA = process.env.APPDATA
    env.LOCALAPPDATA = process.env.LOCALAPPDATA
    env.HOMEDRIVE = process.env.HOMEDRIVE
    env.HOMEPATH = process.env.HOMEPATH
  }
  if (config.dshMode === 'stub' && config.stubExitAfterMs > 0) {
    env.CLOUD_DSH_STUB_EXIT_AFTER_MS = String(config.stubExitAfterMs)
  }
  return env
}

function spawnDsh(config: Config, profileDir: string, instanceId: string, port: number, llmKey: string): ChildProcess {
  const appArgs = [
    '--profile', 'web',
    '--host', '127.0.0.1',
    '--port', String(port),
    '--no-open',
    '--trusted-host', config.publicHost,
    '--public-url', `http://${config.publicHost}/i/${instanceId}/`,
  ]
  const command = config.dshMode === 'stub' ? process.execPath : config.dshBin
  const args = config.dshMode === 'stub' ? [config.dshBin, ...appArgs] : appArgs
  const logPath = path.join(profileDir, 'dsh.log')
  fs.mkdirSync(profileDir, { recursive: true })
  const log = fs.openSync(logPath, 'a')
  const child = spawn(command, args, {
    cwd: profileDir,
    env: dshEnv(config, profileDir, instanceId, llmKey),
    windowsHide: true,
    stdio: ['ignore', log, log],
  })
  child.on('error', () => {
    fs.closeSync(log)
  })
  child.on('close', () => {
    try { fs.closeSync(log) } catch { /* 已关闭 */ }
  })
  return child
}

export function createLauncher(config: Config, db: Db): Launcher {
  const children = new Map<string, ChildProcess>()
  const generations = new Map<string, number>()
  const restarts = new Map<string, number>()
  const locks = new Map<string, Promise<void>>()
  const llmKeys = new Map<string, string>()

  function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(id) || Promise.resolve()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = prev.then(() => gate)
    locks.set(id, tail.then(() => undefined, () => undefined))
    return prev.then(fn, fn).finally(release)
  }

  async function prepareInstance(id: string): Promise<{ profileDir: string, filesDir: string }> {
    const root = path.join(config.storageDir, 'instances', id)
    const profileDir = path.join(root, 'dsh-profile')
    const filesDir = path.join(root, 'files')
    fs.mkdirSync(path.join(root, 'shared'), { recursive: true })
    fs.mkdirSync(profileDir, { recursive: true })
    fs.mkdirSync(path.join(filesDir, '.tmp'), { recursive: true })
    fs.writeFileSync(path.join(root, 'identity.json'), `${JSON.stringify({ instanceId: id, workerId: id })}\n`, 'utf8')
    const apps = listMarketApps(config.appsDir)
    if (apps.length === 0) throw new HttpError(500, '应用市场为空')
    if (config.dshMode === 'stub') writeStubProfile(profileDir, apps)
    else await installRealProfile(config, profileDir, apps)
    return { profileDir, filesDir }
  }

  async function onUnexpectedExit(id: string): Promise<void> {
    await withLock(id, async () => {
      const row = db.get(id)
      if (!row || row.status !== 'running') return
      if (pidAlive(row.pid)) return
      const count = (restarts.get(id) || 0) + 1
      restarts.set(id, count)
      if (count > 3) {
        db.update(id, { status: 'stopped', pid: null })
        return
      }
      try {
        await startUnlocked(id, llmKeys.get(id) || config.defaultLlmKey)
      } catch {
        db.update(id, { status: 'stopped', pid: null })
      }
    })
  }

  async function startUnlocked(id: string, llmKey: string): Promise<InstanceRow> {
    const row = db.get(id)
    if (!row) throw new HttpError(404, '实例不存在')
    if (row.status === 'deleted') throw new HttpError(404, '实例已删除')
    if (row.status === 'running' && pidAlive(row.pid)) return row
    const dirs = await prepareInstance(id)
    const port = await freePort()
    const generation = (generations.get(id) || 0) + 1
    generations.set(id, generation)
    llmKeys.set(id, llmKey)
    let dead = false
    const child = spawnDsh(config, dirs.profileDir, id, port, llmKey)
    children.set(id, child)
    child.on('exit', () => {
      dead = true
      if (generations.get(id) !== generation) return
      void onUnexpectedExit(id)
    })
    try {
      await waitHealthy(port, config.healthTimeoutMs, () => dead || !pidAlive(child.pid ?? null))
    } catch (error) {
      generations.set(id, generation + 1)
      killPid(child.pid)
      children.delete(id)
      throw new HttpError(500, error instanceof Error ? error.message : '实例启动失败')
    }
    db.update(id, { status: 'running', port, pid: child.pid ?? null })
    return db.get(id)!
  }

  const timer = setInterval(() => {
    for (const row of db.list()) {
      if (row.status !== 'running') continue
      if (pidAlive(row.pid)) continue
      void onUnexpectedExit(row.id)
    }
  }, 2000)
  timer.unref?.()

  return {
    async create(requested, llmKey) {
      const id = requested || crypto.randomBytes(8).toString('hex')
      assertId(id)
      if (db.get(id)) throw new HttpError(409, '实例已存在')
      const dirs = await prepareInstance(id)
      db.insert({
        id,
        status: 'created',
        port: null,
        pid: null,
        profile_dir: dirs.profileDir,
        files_dir: dirs.filesDir,
      })
      restarts.set(id, 0)
      try {
        return await withLock(id, () => startUnlocked(id, llmKey || config.defaultLlmKey))
      } catch (error) {
        db.update(id, { status: 'stopped', pid: null })
        throw error
      }
    },
    start(id, llmKey) {
      assertId(id)
      restarts.set(id, 0)
      return withLock(id, () => startUnlocked(id, llmKey || llmKeys.get(id) || config.defaultLlmKey))
    },
    stop(id) {
      assertId(id)
      return withLock(id, async () => {
        const row = db.get(id)
        if (!row || row.status === 'deleted') throw new HttpError(404, '实例不存在')
        generations.set(id, (generations.get(id) || 0) + 1)
        killPid(children.get(id)?.pid ?? row.pid)
        children.delete(id)
        db.update(id, { status: 'stopped', pid: null })
        restarts.set(id, 0)
        return db.get(id)!
      })
    },
    async remove(id) {
      const stopped = await this.stop(id).catch((error: unknown) => {
        if (error instanceof HttpError && error.status === 404) throw error
        const row = db.get(id)
        if (!row) throw new HttpError(404, '实例不存在')
        return row
      })
      if (stopped.status === 'deleted') return stopped
      db.update(id, { status: 'deleted', pid: null })
      return db.get(id)!
    },
    ensure(id, llmKey) {
      assertId(id)
      return withLock(id, async () => {
        const row = db.get(id)
        if (!row || row.status === 'deleted') throw new HttpError(404, '实例不存在')
        if (row.status === 'running' && pidAlive(row.pid)) return row
        restarts.set(id, 0)
        return startUnlocked(id, llmKey || llmKeys.get(id) || config.defaultLlmKey)
      })
    },
    list() {
      return db.list()
    },
    async recover() {
      for (const row of db.list()) {
        if (row.status !== 'running') continue
        if (pidAlive(row.pid)) continue
        restarts.set(row.id, 0)
        try {
          await withLock(row.id, () => startUnlocked(row.id, llmKeys.get(row.id) || config.defaultLlmKey))
        } catch {
          db.update(row.id, { status: 'stopped', pid: null })
        }
      }
    },
    close() {
      clearInterval(timer)
    },
  }
}
