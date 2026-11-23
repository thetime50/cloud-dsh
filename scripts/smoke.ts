import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startMock } from '../test/mock-playsite.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-dsh-smoke-'))
const mock = await startMock({
  'token-a': { userId: 'user-a', instanceIds: ['inst-a'], llmKey: 'key-a' },
  'token-b': { userId: 'user-b', instanceIds: ['inst-b'], llmKey: 'key-b' },
})

function env(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUD_DSH_STORAGE: path.join(root, 'storage'),
    CLOUD_DSH_PRIVATE: path.join(root, 'private'),
    CLOUD_DSH_APPS: path.resolve('apps'),
    CLOUD_DSH_DB: path.join(root, 'private', 'infrastructure', 'control.db'),
    CLOUD_DSH_SANDBOX_LOG: path.join(root, 'private', 'infrastructure', 'sandbox.ndjson'),
    CLOUD_DSH_DSH_BIN: path.resolve('test/stub-dsh.mjs'),
    CLOUD_DSH_DSH_MODE: 'stub',
    CLOUD_DSH_ADMIN_TOKEN: 'smoke-admin',
    CLOUD_DSH_DEFAULT_LLM_KEY: 'default-key',
    CLOUD_DSH_PLAY_SITE_URL: mock.url,
    CLOUD_DSH_GATEWAY_HOST: '127.0.0.1',
    CLOUD_DSH_GATEWAY_PORT: '0',
    CLOUD_DSH_HEALTH_TIMEOUT_MS: '8000',
    CLOUD_DSH_SANDBOX_BIN: path.resolve('src/sandbox-run.ts'),
  }
}

function waitListen(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      reject(new Error(buffer || '监听超时'))
    }, 20000)
    const take = (chunk: Buffer) => {
      if (done) return
      buffer += chunk.toString('utf8')
      const match = buffer.match(/cloud-dsh listening \S+:(\d+)/)
      if (!match) return
      done = true
      clearTimeout(timer)
      resolve(Number(match[1]))
    }
    child.stdout?.on('data', take)
    child.stderr?.on('data', take)
    child.on('exit', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      reject(new Error(`入口退出 ${code}: ${buffer}`))
    })
  })
}

function startServer(): ChildProcess {
  return spawn(process.execPath, ['--experimental-strip-types', path.resolve('src/index.ts')], {
    env: env(),
    windowsHide: true,
  })
}

async function admin(port: number, method: string, pathname: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: {
      authorization: 'Bearer smoke-admin',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${pathname} ${response.status} ${text}`)
  return text ? JSON.parse(text) as { id: string, status: string, files_dir: string, profile_dir: string } : null
}

async function sandbox(args: string[], input = ''): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', path.resolve('src/sandbox-run.ts'), ...args], {
      env: {
        ...process.env,
        CLOUD_DSH_DB: path.join(root, 'private', 'infrastructure', 'control.db'),
        CLOUD_DSH_SANDBOX_LOG: path.join(root, 'private', 'infrastructure', 'sandbox.ndjson'),
        CLOUD_DSH_SANDBOX_PATH: process.env.PATH || '',
        DEEPSEEK_API_KEY: 'super-secret',
      },
      windowsHide: true,
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
    child.stdin.end(input)
  })
}

let server: ChildProcess | undefined
try {
  server = startServer()
  let port = await waitListen(server)
  await admin(port, 'POST', '/admin/instances', { id: 'inst-a' })
  await admin(port, 'POST', '/admin/instances', { id: 'inst-b' })

  const forged = await fetch(`http://127.0.0.1:${port}/i/inst-a/`, { headers: { 'x-user-id': 'user-a' } })
  if (forged.status !== 401) throw new Error(`伪造身份应拒绝，实际 ${forged.status}`)
  const cross = await fetch(`http://127.0.0.1:${port}/i/inst-b/`, { headers: { cookie: 'play_site_token=token-a' } })
  if (cross.status !== 403) throw new Error(`越权应拒绝，实际 ${cross.status}`)
  const pageA = await fetch(`http://127.0.0.1:${port}/i/inst-a/`, { headers: { cookie: 'play_site_token=token-a' } })
  const htmlA = await pageA.text()
  if (pageA.status !== 200 || !htmlA.includes('instance=inst-a')) throw new Error('用户 A 没有进入自己的实例')
  const pageB = await fetch(`http://127.0.0.1:${port}/i/inst-b/`, { headers: { cookie: 'play_site_token=token-b' } })
  const htmlB = await pageB.text()
  if (pageB.status !== 200 || !htmlB.includes('instance=inst-b')) throw new Error('用户 B 没有进入自己的实例')

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'storage', 'instances', 'inst-a', 'dsh-profile', 'profiles', 'web', 'package.json'), 'utf8')) as {
    dsh: { profile: { bundles: string[] } }
  }
  if (!manifest.dsh.profile.bundles.includes('cloud-dsh-app-base')) throw new Error('实例未装 base')
  if (!manifest.dsh.profile.bundles.includes('cloud-dsh-app-rag-blank')) throw new Error('实例未装 rag-blank')
  const basePersona = fs.readFileSync(path.resolve('apps/base/persona.mjs'), 'utf8')
  const ragPersona = fs.readFileSync(path.resolve('apps/rag-blank/persona.mjs'), 'utf8')
  const ragPatch = fs.readFileSync(path.resolve('apps/rag-blank/cordis.patch.yml'), 'utf8')
  if (basePersona === ragPersona) throw new Error('两个应用的启动提示语相同')
  if (!ragPersona.includes('不要编造出处')) throw new Error('rag-blank 提示语不对')
  if (!ragPatch.includes('cloud-dsh-app-base/tools.mjs')) throw new Error('rag-blank 没有继承 base 工具')

  const writeCode = await sandbox(['--instance', 'inst-a', '--timeout', '30s', '--', 'file', 'write', 'hello.txt'], 'hello')
  if (writeCode !== 0) throw new Error('沙箱写入失败')
  const hello = path.join(root, 'storage', 'instances', 'inst-a', 'files', 'hello.txt')
  if (fs.readFileSync(hello, 'utf8') !== 'hello') throw new Error('文件没有落在实例 files/')
  const escapeCode = await sandbox(['--instance', 'inst-a', '--timeout', '30s', '--', 'file', 'write', '../outside.txt'], 'no')
  if (escapeCode === 0) throw new Error('越界写入没有被拒绝')
  const envCode = await sandbox(['--instance', 'inst-a', '--timeout', '30s', '--', 'node', '-e', 'if (process.env.DEEPSEEK_API_KEY) process.exit(2)'])
  if (envCode !== 0) throw new Error('沙箱环境里还能看到 API Key')
  const slow = Date.now()
  const timeoutCode = await sandbox(['--instance', 'inst-a', '--timeout', '1s', '--', 'node', '-e', 'setTimeout(() => {}, 30000)'])
  if (timeoutCode !== 124 || Date.now() - slow > 10000) throw new Error('超时没有结束这次执行')
  const after = await fetch(`http://127.0.0.1:${port}/i/inst-a/`, { headers: { cookie: 'play_site_token=token-a' } })
  if (after.status !== 200) throw new Error('超时后实例页面不在了')

  await admin(port, 'POST', '/admin/instances/inst-b/stop')
  server.kill()
  await new Promise((resolve) => server?.once('exit', resolve))
  server = startServer()
  port = await waitListen(server)
  const deadline = Date.now() + 15000
  let rows: { id: string, status: string }[] = []
  while (Date.now() < deadline) {
    rows = await admin(port, 'GET', '/admin/instances') as unknown as { id: string, status: string }[]
    if (rows.find((row) => row.id === 'inst-a')?.status === 'running') break
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  const rowA = rows.find((row) => row.id === 'inst-a')
  const rowB = rows.find((row) => row.id === 'inst-b')
  if (rowA?.status !== 'running') throw new Error('重启后 running 实例没有回来')
  if (rowB?.status !== 'stopped') throw new Error('停止的实例被重新拉起')
  const back = await fetch(`http://127.0.0.1:${port}/i/inst-a/`, { headers: { cookie: 'play_site_token=token-a' } })
  if (back.status !== 200) throw new Error('重启后打不开原实例')
  process.stdout.write('smoke ok\n')
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
} finally {
  server?.kill()
  await mock.close()
}
