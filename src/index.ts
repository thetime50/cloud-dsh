#!/usr/bin/env node
import { loadConfig } from './config.ts'
import { openDb } from './db.ts'
import { startGateway } from './gateway.ts'
import { createLauncher } from './launcher.ts'

const config = loadConfig()
const db = openDb(config.dbPath)
const launcher = createLauncher(config, db)
const gateway = await startGateway(config, launcher)
await launcher.recover()
console.log(`cloud-dsh listening ${config.gatewayHost}:${gateway.port}`)

let closing = false
async function shutdown(): Promise<void> {
  if (closing) return
  closing = true
  launcher.close()
  await gateway.close()
  db.close()
  process.exit(0)
}

process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
