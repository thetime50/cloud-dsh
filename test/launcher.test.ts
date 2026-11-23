import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { persona as basePersona } from '../apps/base/persona.mjs'
import { persona as ragPersona } from '../apps/rag-blank/persona.mjs'
import { openDb } from '../src/db.ts'
import { createLauncher } from '../src/launcher.ts'
import { listMarketApps } from '../src/market.ts'
import { pidAlive } from '../src/proc.ts'
import { tempConfig } from './helpers.ts'

async function stopAll(launcher: ReturnType<typeof createLauncher>, db: ReturnType<typeof openDb>) {
  for (const row of db.list()) {
    if (row.status === 'deleted') continue
    await launcher.stop(row.id).catch(() => undefined)
  }
  launcher.close()
  db.close()
}

test('market exposes base and rag-blank', () => {
  const apps = listMarketApps(path.resolve('apps'))
  assert.deepEqual(apps.map((app) => app.id), ['base', 'rag-blank'])
  assert.equal(apps[0]?.name, '基础助手')
  assert.equal(apps[1]?.description, '继承基础助手，知识库尚未接入')
  assert.notEqual(basePersona, ragPersona)
  assert.match(ragPersona, /不要编造出处/)
  const basePatch = fs.readFileSync(path.resolve('apps/base/cordis.patch.yml'), 'utf8')
  const ragPatch = fs.readFileSync(path.resolve('apps/rag-blank/cordis.patch.yml'), 'utf8')
  assert.match(basePatch, /id: base/)
  assert.match(ragPatch, /id: rag-blank/)
  assert.match(basePatch, /cloud-dsh-app-base\/tools\.mjs/)
  assert.match(ragPatch, /cloud-dsh-app-base\/tools\.mjs/)
})

test('two instances start and stop independently', async () => {
  const config = tempConfig()
  const db = openDb(config.dbPath)
  const launcher = createLauncher(config, db)
  try {
    const first = await launcher.create('inst-a')
    const second = await launcher.create('inst-b')
    assert.equal(first.status, 'running')
    assert.equal(second.status, 'running')
    assert.notEqual(first.pid, second.pid)
    assert.notEqual(first.port, second.port)
    assert.equal(fs.existsSync(path.join(first.files_dir, '.tmp')), true)
    assert.equal(fs.existsSync(path.join(first.profile_dir, 'profiles', 'web', 'package.json')), true)
    const manifest = JSON.parse(fs.readFileSync(path.join(first.profile_dir, 'profiles', 'web', 'package.json'), 'utf8'))
    assert.ok(manifest.dsh.profile.bundles.includes('cloud-dsh-app-base'))
    assert.ok(manifest.dsh.profile.bundles.includes('cloud-dsh-app-rag-blank'))
    const stopped = await launcher.stop(first.id)
    assert.equal(stopped.status, 'stopped')
    assert.equal(fs.existsSync(first.files_dir), true)
    const health = await fetch(`http://127.0.0.1:${second.port}/`)
    assert.equal(health.status, 200)
    assert.match(await health.text(), /instance=inst-b/)
    assert.equal(pidAlive(second.pid), true)
    assert.equal(pidAlive(first.pid), false)
  } finally {
    await stopAll(launcher, db)
  }
})

test('entry restart relaunches a dead running instance', async () => {
  const config = tempConfig()
  const db = openDb(config.dbPath)
  const launcher = createLauncher(config, db)
  const id = 'recovered'
  const profileDir = path.join(config.storageDir, 'instances', id, 'dsh-profile')
  const filesDir = path.join(config.storageDir, 'instances', id, 'files')
  let deadPid = 2_000_000_000
  while (pidAlive(deadPid)) deadPid -= 1
  db.insert({
    id,
    status: 'running',
    port: 1,
    pid: deadPid,
    profile_dir: profileDir,
    files_dir: filesDir,
  })
  try {
    await launcher.recover()
    const row = db.get(id)
    assert.equal(row?.status, 'running')
    assert.notEqual(row?.pid, deadPid)
    const health = await fetch(`http://127.0.0.1:${row?.port}/`)
    assert.equal(health.status, 200)
    assert.match(await health.text(), /instance=recovered/)
  } finally {
    await stopAll(launcher, db)
  }
})

test('crash loop stops after three relaunches', async () => {
  const config = tempConfig({ stubExitAfterMs: 1200 })
  const db = openDb(config.dbPath)
  const launcher = createLauncher(config, db)
  try {
    await launcher.create('crashy')
    const deadline = Date.now() + 20000
    let status = 'running'
    while (Date.now() < deadline) {
      status = db.get('crashy')?.status || ''
      if (status === 'stopped') break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    assert.equal(status, 'stopped')
    assert.equal(fs.existsSync(path.join(config.storageDir, 'instances', 'crashy', 'files')), true)
  } finally {
    await stopAll(launcher, db)
  }
})
