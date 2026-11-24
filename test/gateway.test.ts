import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import net from 'node:net'
import test from 'node:test'
import type { Config } from '../src/config.ts'
import { openDb } from '../src/db.ts'
import { startGateway } from '../src/gateway.ts'
import { createLauncher } from '../src/launcher.ts'
import { tempConfig } from './helpers.ts'
import { startMock } from './mock-playsite.mjs'

async function scene(patch: Partial<Config> = {}) {
  const mock = await startMock({
    'token-a': { userId: 'user-a', instanceIds: ['inst-a', 'missing'], llmKey: 'key-from-site' },
    'token-b': { userId: 'user-b', instanceIds: ['inst-b'], llmKey: 'key-b' },
  })
  const config = tempConfig({ playSiteUrl: mock.url, defaultLlmKey: 'default-key', ...patch })
  const db = openDb(config.dbPath)
  const launcher = createLauncher(config, db)
  const gateway = await startGateway(config, launcher)
  return { mock, config, db, launcher, gateway }
}

async function closeScene(state: Awaited<ReturnType<typeof scene>>) {
  await state.gateway.close()
  for (const row of state.db.list()) {
    if (row.status !== 'deleted') await state.launcher.stop(row.id).catch(() => undefined)
  }
  state.launcher.close()
  state.db.close()
  await state.mock.close()
}

function admin(port: number, method: string, pathname: string, token = 'test-admin-token', body?: unknown) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('gateway proxies only after play-site accepts the instance', async () => {
  const state = await scene()
  try {
    const createdA = await admin(state.gateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-a' })
    assert.equal(createdA.status, 201)
    const createdB = await admin(state.gateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-b' })
    assert.equal(createdB.status, 201)
    const denied = await admin(state.gateway.port, 'GET', '/admin/instances', 'nope')
    assert.equal(denied.status, 401)

    const missingCookie = await fetch(`http://127.0.0.1:${state.gateway.port}/i/inst-a/`, {
      headers: { 'x-user-id': 'user-a' },
    })
    assert.equal(missingCookie.status, 401)
    assert.equal((await missingCookie.text()).includes('stub-dsh'), false)

    const wrongUser = await fetch(`http://127.0.0.1:${state.gateway.port}/i/inst-b/`, {
      headers: { cookie: 'play_site_token=token-a', 'x-user-id': 'user-a' },
    })
    assert.equal(wrongUser.status, 403)

    const page = await fetch(`http://127.0.0.1:${state.gateway.port}/i/inst-a/`, {
      headers: { cookie: 'play_site_token=token-a' },
    })
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.match(html, /instance=inst-a/)
    assert.match(html, /llm=set/)
    assert.match(html, /data-cloud-dsh="prefix"/)
    assert.equal(html.includes('key-from-site'), false)

    const absent = await fetch(`http://127.0.0.1:${state.gateway.port}/i/missing/`, {
      headers: { cookie: 'play_site_token=token-a' },
    })
    assert.equal(absent.status, 404)
    assert.equal(state.db.get('missing'), undefined)

    const stopped = await admin(state.gateway.port, 'POST', '/admin/instances/inst-b/stop')
    assert.equal(stopped.status, 200)
    const still = await fetch(`http://127.0.0.1:${state.gateway.port}/i/inst-a/`, {
      headers: { cookie: 'play_site_token=token-a' },
    })
    assert.equal(still.status, 200)

    const key = crypto.randomBytes(16).toString('base64')
    const upgraded = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(state.gateway.port, '127.0.0.1', () => {
        socket.write([
          'GET /i/inst-a/ HTTP/1.1',
          'Host: 127.0.0.1',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          'Cookie: play_site_token=token-a',
          '',
          '',
        ].join('\r\n'))
      })
      socket.setTimeout(5000, () => {
        socket.destroy()
        reject(new Error('websocket timeout'))
      })
      let data = ''
      socket.on('data', (chunk) => {
        data += chunk.toString('utf8')
        if (data.includes('\r\n\r\n')) {
          socket.end()
          resolve(data)
        }
      })
      socket.on('error', reject)
    })
    assert.match(upgraded, /101/)

    const blocked = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(state.gateway.port, '127.0.0.1', () => {
        socket.write([
          'GET /i/inst-a/ HTTP/1.1',
          'Host: 127.0.0.1',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          'X-User-Id: user-a',
          '',
          '',
        ].join('\r\n'))
      })
      socket.setTimeout(5000, () => {
        socket.destroy()
        reject(new Error('websocket timeout'))
      })
      let data = ''
      socket.on('data', (chunk) => {
        data += chunk.toString('utf8')
        socket.end()
        resolve(data)
      })
      socket.on('error', reject)
    })
    assert.match(blocked, /401/)
  } finally {
    await closeScene(state)
  }
})

test('approved play-site opens a tunnel host without a cookie', async () => {
  const mock = await startMock(null)
  const config = tempConfig({ playSiteUrl: mock.url, defaultLlmKey: 'default-key' })
  const db = openDb(config.dbPath)
  const launcher = createLauncher(config, db)
  const gateway = await startGateway(config, launcher)
  const state = { mock, config, db, launcher, gateway }
  try {
    const created = await admin(gateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-a' })
    assert.equal(created.status, 201)
    const remote = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(gateway.port, '127.0.0.1', () => {
        socket.write([
          'GET /i/inst-a/ HTTP/1.1',
          'Host: collectables-templates-pmc-boom.trycloudflare.com',
          'Connection: close',
          '',
          '',
        ].join('\r\n'))
      })
      socket.setTimeout(5000, () => {
        socket.destroy()
        reject(new Error('remote open timeout'))
      })
      let data = ''
      socket.on('data', (chunk) => {
        data += chunk.toString('utf8')
      })
      socket.on('end', () => resolve(data))
      socket.on('error', reject)
    })
    assert.match(remote, /^HTTP\/1\.1 200/)
    assert.match(remote, /instance=inst-a/)
  } finally {
    await closeScene(state)
  }
})

test('stopped instance is not opened again', async () => {
  const state = await scene()
  try {
    const created = await admin(state.gateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-a' })
    assert.equal(created.status, 201)
    const stopped = await admin(state.gateway.port, 'POST', '/admin/instances/inst-a/stop')
    assert.equal(stopped.status, 200)
    const page = await fetch(`http://127.0.0.1:${state.gateway.port}/i/inst-a/`)
    assert.equal(page.status, 503)
    assert.match(await page.text(), /实例已停止/)
    assert.equal(state.db.get('inst-a')?.status, 'stopped')
  } finally {
    await closeScene(state)
  }
})

test('env list follows the play-site user and still opens when that site approves everyone', async () => {
  const state = await scene()
  const approved = await startMock(null)
  const approvedConfig = tempConfig({ playSiteUrl: approved.url, defaultLlmKey: 'default-key' })
  const approvedDb = openDb(approvedConfig.dbPath)
  const approvedLauncher = createLauncher(approvedConfig, approvedDb)
  const approvedGateway = await startGateway(approvedConfig, approvedLauncher)
  try {
    await admin(state.gateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-a' })
    await admin(state.gateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-b' })
    const denied = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances`)
    assert.equal(denied.status, 401)
    const userA = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances`, {
      headers: { cookie: 'play_site_token=token-a' },
    })
    assert.equal(userA.status, 200)
    assert.deepEqual((await userA.json() as { id: string }[]).map((row) => row.id), ['inst-a'])

    const createdA = await admin(approvedGateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-a' })
    const createdB = await admin(approvedGateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-b' })
    assert.equal(createdA.status, 201)
    assert.equal(createdB.status, 201)
    approved.setInstances(['inst-a', 'inst-b'])
    const everyone = await fetch(`http://127.0.0.1:${approvedGateway.port}/manage/api/instances`)
    assert.equal(everyone.status, 200)
    assert.deepEqual((await everyone.json() as { id: string }[]).map((row) => row.id), ['inst-a', 'inst-b'])
  } finally {
    await approvedGateway.close()
    for (const row of approvedDb.list()) {
      if (row.status !== 'deleted') await approvedLauncher.stop(row.id).catch(() => undefined)
    }
    approvedLauncher.close()
    approvedDb.close()
    await approved.close()
    await closeScene(state)
  }
})

test('manage api creates starts stops and deletes without auth', async () => {
  const state = await scene()
  try {
    const created = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'manage-test' }),
    })
    assert.equal(created.status, 201)

    const listed = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances`)
    assert.equal(listed.status, 401)
    assert.match(await listed.text(), /未登录/)

    const mine = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances`, {
      headers: { cookie: 'play_site_token=token-a' },
    })
    assert.equal(mine.status, 200)
    const rows = await mine.json() as { id: string }[]
    assert.equal(rows.some((row) => row.id === 'manage-test'), false)

    const stopped = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances/manage-test/stop`, {
      method: 'POST',
    })
    assert.equal(stopped.status, 200)
    assert.equal(((await stopped.json()) as { status: string }).status, 'stopped')

    const started = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances/manage-test/start`, {
      method: 'POST',
    })
    assert.equal(started.status, 200)
    assert.equal(((await started.json()) as { status: string }).status, 'running')

    const removed = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/instances/manage-test`, {
      method: 'DELETE',
    })
    assert.equal(removed.status, 200)
    assert.equal(((await removed.json()) as { status: string }).status, 'deleted')

    const page = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/test`)
    assert.equal(page.status, 503)

    const apps = await fetch(`http://127.0.0.1:${state.gateway.port}/manage/api/apps`)
    assert.equal(apps.status, 200)
    const listedApps = await apps.json() as { id: string, name: string, kind: string, description: string }[]
    assert.deepEqual(listedApps.map((app) => app.id), ['base', 'rag-blank'])
    assert.equal(listedApps[0]?.name, '基础助手')
    assert.equal('dir' in (listedApps[0] || {}), false)
  } finally {
    await closeScene(state)
  }
})
