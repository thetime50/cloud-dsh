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

test('local dev open skips play-site only on localhost', async () => {
  const state = await scene({ devOpen: true })
  try {
    const created = await admin(state.gateway.port, 'POST', '/admin/instances', 'test-admin-token', { id: 'inst-a' })
    assert.equal(created.status, 201)
    const page = await fetch(`http://127.0.0.1:${state.gateway.port}/i/inst-a/`)
    assert.equal(page.status, 200)
    const remote = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(state.gateway.port, '127.0.0.1', () => {
        socket.write([
          'GET /i/inst-a/ HTTP/1.1',
          'Host: dsh.example.com',
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
    assert.match(remote, /^HTTP\/1\.1 401/)
  } finally {
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
    assert.equal(listed.status, 200)
    const rows = await listed.json() as { id: string, status: string }[]
    assert.ok(rows.some((row) => row.id === 'manage-test'))

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
  } finally {
    await closeScene(state)
  }
})
