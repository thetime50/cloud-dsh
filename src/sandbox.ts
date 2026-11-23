import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { finished } from 'node:stream/promises'
import type { Db } from './db.ts'
import { killPid } from './proc.ts'

export const OUTPUT_CAP = 1024 * 1024

export type SandboxRequest = {
  instanceId: string
  timeoutMs: number
  sessionId: string
  agentId: string
  taskId: string
  traceId: string
  userId: string
  command: string[]
  db: Db
  logPath: string
  sandboxPath: string
  uvBin: string
  runtimeDir: string
  stdin?: NodeJS.ReadableStream
  stdout?: NodeJS.WritableStream
  stderr?: NodeJS.WritableStream
}

export type SandboxResult = {
  exitCode: number
  timedOut: boolean
}

function appendLog(logPath: string, fields: Record<string, string | number>): void {
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...fields })}\n`, 'utf8')
}

export function resolveInside(root: string, userPath: string): string {
  if (!userPath || userPath.includes('\0')) throw new Error('拒绝：路径超出工作根')
  if (path.isAbsolute(userPath) || /^[A-Za-z]:[\\/]/.test(userPath)) throw new Error('拒绝：路径超出工作根')
  const parts = userPath.split(/[\\/]+/).filter(Boolean)
  if (parts.length === 0 || parts.includes('..')) throw new Error('拒绝：路径超出工作根')
  const base = path.resolve(root)
  const target = path.resolve(base, userPath)
  const relative = path.relative(base, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('拒绝：路径超出工作根')
  if (fs.existsSync(target)) {
    const realRoot = fs.realpathSync(base)
    const realTarget = fs.realpathSync(target)
    const realRelative = path.relative(realRoot, realTarget)
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('拒绝：路径超出工作根')
  }
  return target
}

function which(name: string, pathEnv: string): string | undefined {
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean)
    : ['']
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue
    const candidates = path.extname(name) ? [name] : [name, ...exts.map((ext) => name + ext.toLowerCase()), ...exts.map((ext) => name + ext)]
    for (const candidate of candidates) {
      const full = path.join(dir, candidate)
      if (fs.existsSync(full)) return full
    }
  }
  return undefined
}

function resolveInterpreter(kind: string, pathEnv: string): string {
  const aliases: Record<string, string[]> = {
    node: ['node'],
    sh: ['sh', 'bash'],
    bash: ['bash', 'sh'],
  }
  const names = aliases[kind]
  if (!names) throw new Error('拒绝：不支持的命令')
  for (const name of names) {
    const found = which(name, pathEnv)
    if (found) return found
  }
  throw new Error(`拒绝：找不到 ${kind}`)
}

function sameFile(filePath: string): string {
  try {
    return fs.realpathSync(filePath)
  } catch {
    return path.resolve(filePath)
  }
}

function uvEnv(pathEnv: string): NodeJS.ProcessEnv {
  const tmp = os.tmpdir()
  const env: NodeJS.ProcessEnv = {
    PATH: pathEnv,
    LANG: process.env.LANG || 'C.UTF-8',
    HOME: tmp,
    TMPDIR: tmp,
    UV_PYTHON_DOWNLOADS: 'never',
    UV_CACHE_DIR: path.join(tmp, 'cloud-dsh-uv-cache'),
  }
  if (process.platform === 'win32') {
    env.SYSTEMROOT = process.env.SYSTEMROOT
    env.PATHEXT = process.env.PATHEXT
    env.COMSPEC = process.env.COMSPEC
    env.USERPROFILE = tmp
    env.TEMP = tmp
    env.TMP = tmp
  }
  return env
}

function uvPythonFind(uvBin: string, pathEnv: string, request: string): string {
  const args = ['python', 'find']
  if (request) args.push(request)
  const result = spawnSync(uvBin, args, {
    cwd: os.tmpdir(),
    env: uvEnv(pathEnv),
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new Error('拒绝：找不到 uv')
    throw new Error('拒绝：Python 版本未提供')
  }
  if (result.status !== 0) throw new Error('拒绝：Python 版本未提供')
  const found = result.stdout.trim().split(/\r?\n/).filter(Boolean).pop()?.trim() || ''
  if (!found) throw new Error('拒绝：Python 版本未提供')
  return found
}

function readPythonPin(filesDir: string): string {
  const pin = path.join(filesDir, '.python-version')
  if (!fs.existsSync(pin)) return ''
  const line = fs.readFileSync(pin, 'utf8').split(/\r?\n/).map((item) => item.trim()).find((item) => item && !item.startsWith('#'))
  return line || ''
}

function runtimePythons(runtimeDir: string): string[] {
  if (!runtimeDir) return []
  const root = path.join(runtimeDir, 'python')
  if (!fs.existsSync(root)) return []
  const names = process.platform === 'win32' ? ['python.exe'] : ['python3', 'python']
  const found: string[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    for (const name of names) {
      const bin = process.platform === 'win32'
        ? path.join(root, entry.name, name)
        : path.join(root, entry.name, 'bin', name)
      if (fs.existsSync(bin)) {
        found.push(bin)
        break
      }
    }
  }
  return found
}

function resolvePython(filesDir: string, uvBin: string, pathEnv: string, runtimeDir: string): string {
  const fallback = uvPythonFind(uvBin, pathEnv, '')
  const request = readPythonPin(filesDir)
  if (!request) return fallback
  const selected = uvPythonFind(uvBin, pathEnv, request)
  const allowed = new Set([sameFile(fallback), ...runtimePythons(runtimeDir).map(sameFile)])
  if (!allowed.has(sameFile(selected))) throw new Error('拒绝：Python 版本未提供')
  return selected
}

function isPython(kind: string): boolean {
  return kind === 'py' || kind === 'python' || kind === 'python3'
}

function looksLikeEscape(arg: string): boolean {
  if (!arg || arg.includes('\0')) return true
  if (arg === '-c' || arg === '-e' || arg === '-' || arg.startsWith('-')) return false
  if (path.isAbsolute(arg) || /^[A-Za-z]:[\\/]/.test(arg)) return true
  return arg.split(/[\\/]+/).includes('..')
}

function childEnv(filesDir: string, pathEnv: string): NodeJS.ProcessEnv {
  const tmp = path.join(filesDir, '.tmp')
  fs.mkdirSync(tmp, { recursive: true })
  const env: NodeJS.ProcessEnv = {
    PATH: pathEnv,
    LANG: process.env.LANG || 'C.UTF-8',
    TMPDIR: tmp,
    HOME: filesDir,
  }
  if (process.platform === 'win32') {
    env.TEMP = tmp
    env.TMP = tmp
    env.USERPROFILE = filesDir
    env.SYSTEMROOT = process.env.SYSTEMROOT
    env.PATHEXT = process.env.PATHEXT
    env.COMSPEC = process.env.COMSPEC
  }
  return env
}

function pipeCap(source: NodeJS.ReadableStream, target: NodeJS.WritableStream, cap: number): void {
  let used = 0
  source.on('data', (chunk: Buffer) => {
    if (used >= cap) return
    const slice = chunk.subarray(0, cap - used)
    used += slice.length
    target.write(slice)
  })
}

async function runFile(filesDir: string, args: string[], stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream): Promise<void> {
  const op = args[0]
  const rel = args[1]
  if (!op || !rel) throw new Error('拒绝：文件命令不完整')
  const target = resolveInside(filesDir, rel)
  if (op === 'read') {
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error('文件不存在')
    const stream = fs.createReadStream(target)
    pipeCap(stream, stdout, OUTPUT_CAP)
    await finished(stream)
    return
  }
  if (op === 'write') {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const stream = fs.createWriteStream(target)
    stdin.pipe(stream)
    await finished(stream)
    return
  }
  throw new Error('拒绝：不支持的文件命令')
}

function spawnInterpreter(filesDir: string, kind: string, args: string[], pathEnv: string, uvBin: string, runtimeDir: string, stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream): ChildProcess {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '-c' || args[index] === '-e') {
      index += 1
      continue
    }
    if (looksLikeEscape(args[index] || '')) throw new Error('拒绝：路径超出工作根')
  }
  const executable = isPython(kind) ? resolvePython(filesDir, uvBin, pathEnv, runtimeDir) : resolveInterpreter(kind, pathEnv)
  const interpreterPath = isPython(kind) ? `${path.dirname(executable)}${path.delimiter}${pathEnv}` : pathEnv
  const child = spawn(executable, args, {
    cwd: filesDir,
    env: childEnv(filesDir, interpreterPath),
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  stdin.pipe(child.stdin!)
  if (child.stdout) pipeCap(child.stdout, stdout, OUTPUT_CAP)
  if (child.stderr) pipeCap(child.stderr, stderr, OUTPUT_CAP)
  return child
}

export async function runSandbox(request: SandboxRequest): Promise<SandboxResult> {
  const stdout = request.stdout || process.stdout
  const stderr = request.stderr || process.stderr
  const stdin = request.stdin || process.stdin
  const baseLog = {
    userId: request.userId,
    workspaceId: '',
    sessionId: request.sessionId,
    agentId: request.agentId,
    taskId: request.taskId,
    workerId: '',
    traceId: request.traceId,
    exitCode: 1,
  }
  const row = request.db.get(request.instanceId)
  if (!row || row.status === 'deleted') {
    appendLog(request.logPath, baseLog)
    throw new Error('拒绝：实例不存在')
  }
  baseLog.workspaceId = row.id
  baseLog.workerId = row.id
  const filesDir = row.files_dir
  fs.mkdirSync(path.join(filesDir, '.tmp'), { recursive: true })
  const [kind, ...args] = request.command
  if (!kind) {
    appendLog(request.logPath, baseLog)
    throw new Error('拒绝：缺少命令')
  }
  try {
    if (kind === 'file') {
      await runFile(filesDir, args, stdin, stdout)
      baseLog.exitCode = 0
      appendLog(request.logPath, baseLog)
      return { exitCode: 0, timedOut: false }
    }
    const child = spawnInterpreter(filesDir, kind, args, request.sandboxPath, request.uvBin, request.runtimeDir, stdin, stdout, stderr)
    const outcome = await new Promise<{ exitCode: number, timedOut: boolean }>((resolve, reject) => {
      let settled = false
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        killPid(child.pid)
      }, request.timeoutMs)
      child.on('error', (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
      })
      child.on('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ exitCode: timedOut ? 124 : (code ?? 1), timedOut })
      })
    })
    baseLog.exitCode = outcome.exitCode
    appendLog(request.logPath, baseLog)
    return outcome
  } catch (error) {
    appendLog(request.logPath, baseLog)
    throw error
  }
}

export function parseTimeout(value: string): number {
  const match = /^(\d+)(ms|s)?$/.exec(value.trim())
  if (!match) throw new Error('超时格式无效')
  const amount = Number(match[1])
  const timeout = match[2] === 'ms' ? amount : amount * 1000
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('超时格式无效')
  return timeout
}

export function parseSandboxArgs(argv: string[]): {
  instanceId: string
  timeoutMs: number
  sessionId: string
  agentId: string
  taskId: string
  traceId: string
  command: string[]
} {
  let instanceId = ''
  let timeout = '30s'
  let sessionId = ''
  let agentId = ''
  let taskId = ''
  let traceId = ''
  let command: string[] | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--') {
      command = argv.slice(index + 1)
      break
    }
    const next = argv[index + 1]
    if (token === '--instance') instanceId = next || ''
    else if (token === '--timeout') timeout = next || ''
    else if (token === '--session') sessionId = next || ''
    else if (token === '--agent') agentId = next || ''
    else if (token === '--task') taskId = next || ''
    else if (token === '--trace') traceId = next || ''
    else throw new Error(`未知参数 ${token}`)
    index += 1
  }
  if (!instanceId) throw new Error('缺少实例 id')
  if (!command || command.length === 0) throw new Error('缺少命令')
  return {
    instanceId,
    timeoutMs: parseTimeout(timeout),
    sessionId,
    agentId,
    taskId,
    traceId,
    command,
  }
}
