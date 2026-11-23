import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { openDb } from '../src/db.ts'
import { tempConfig } from './helpers.ts'

function run(config: ReturnType<typeof tempConfig>, args: string[], input = ''): Promise<{ code: number, stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', path.resolve('src/sandbox-run.ts'), ...args], {
      env: {
        ...process.env,
        CLOUD_DSH_DB: config.dbPath,
        CLOUD_DSH_SANDBOX_LOG: config.sandboxLog,
        CLOUD_DSH_SANDBOX_PATH: process.env.PATH || '',
        CLOUD_DSH_PRIVATE: config.privateDir,
        DEEPSEEK_API_KEY: 'super-secret',
        CLOUD_DSH_SECRET: 'also-secret',
      },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
    child.stdin.end(input)
  })
}

test('sandbox keeps writes inside the instance and drops secrets', async () => {
  const config = tempConfig()
  const db = openDb(config.dbPath)
  const firstFiles = path.join(config.storageDir, 'instances', 'box-a', 'files')
  const secondFiles = path.join(config.storageDir, 'instances', 'box-b', 'files')
  fs.mkdirSync(firstFiles, { recursive: true })
  fs.mkdirSync(secondFiles, { recursive: true })
  db.insert({ id: 'box-a', status: 'running', port: null, pid: null, profile_dir: path.join(config.storageDir, 'instances', 'box-a', 'dsh-profile'), files_dir: firstFiles })
  db.insert({ id: 'box-b', status: 'running', port: null, pid: null, profile_dir: path.join(config.storageDir, 'instances', 'box-b', 'dsh-profile'), files_dir: secondFiles })
  db.close()

  const written = await run(config, ['--instance', 'box-a', '--timeout', '30s', '--', 'file', 'write', 'hello.txt'], 'hello')
  assert.equal(written.code, 0, written.stderr)
  assert.equal(fs.readFileSync(path.join(firstFiles, 'hello.txt'), 'utf8'), 'hello')
  assert.equal(fs.existsSync(path.join(secondFiles, 'hello.txt')), false)

  const escaped = await run(config, ['--instance', 'box-a', '--timeout', '30s', '--', 'file', 'write', '../outside.txt'], 'nope')
  assert.notEqual(escaped.code, 0)
  assert.equal(fs.existsSync(path.join(config.storageDir, 'instances', 'box-a', 'outside.txt')), false)
  assert.match(escaped.stderr, /拒绝/)

  const absolute = await run(config, ['--instance', 'box-a', '--timeout', '30s', '--', 'py', path.resolve(firstFiles, 'hello.txt')])
  assert.notEqual(absolute.code, 0)

  const env = await run(config, ['--instance', 'box-a', '--timeout', '30s', '--', 'py', '-c', 'import os; print("KEY="+os.environ.get("DEEPSEEK_API_KEY", "")); print("SECRET="+os.environ.get("CLOUD_DSH_SECRET", "")); print("HOME="+os.environ.get("HOME", ""))'])
  assert.equal(env.code, 0, env.stderr + env.stdout)
  const lines = env.stdout.trim().split(/\r?\n/)
  assert.equal(lines[0], 'KEY=')
  assert.equal(lines[1], 'SECRET=')
  assert.equal(path.resolve((lines[2] || '').slice('HOME='.length)), path.resolve(firstFiles))

  const started = Date.now()
  const timed = await run(config, ['--instance', 'box-a', '--timeout', '1s', '--', 'py', '-c', 'import time; time.sleep(30)'])
  assert.equal(timed.code, 124)
  assert.ok(Date.now() - started < 10000)
  assert.equal(process.pid > 0, true)

  const log = fs.readFileSync(config.sandboxLog, 'utf8')
  assert.match(log, /"workerId":"box-a"/)
  assert.equal(log.includes('super-secret'), false)
  assert.equal(fs.existsSync(path.join(firstFiles, '.venv')), false)

  fs.writeFileSync(path.join(firstFiles, '.python-version'), '9.9\n')
  const pinned = await run(config, ['--instance', 'box-a', '--timeout', '30s', '--', 'py', '-c', 'print(1)'])
  assert.notEqual(pinned.code, 0)
  assert.match(pinned.stderr, /版本未提供/)
  assert.equal(fs.existsSync(path.join(firstFiles, '.venv')), false)
})
