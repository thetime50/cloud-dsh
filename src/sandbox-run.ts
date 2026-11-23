#!/usr/bin/env node
import { loadConfig } from './config.ts'
import { openDb } from './db.ts'
import { parseSandboxArgs, runSandbox } from './sandbox.ts'

const config = loadConfig()
const db = openDb(config.dbPath)

try {
  const parsed = parseSandboxArgs(process.argv.slice(2))
  const result = await runSandbox({
    ...parsed,
    userId: process.env.CLOUD_DSH_USER_ID || '',
    db,
    logPath: config.sandboxLog,
    sandboxPath: config.sandboxPath,
    uvBin: config.uvBin,
    runtimeDir: config.runtimeDir,
  })
  db.close()
  process.exit(result.exitCode)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  db.close()
  process.exit(1)
}
