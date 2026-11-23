import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type InstanceStatus = 'created' | 'running' | 'stopped' | 'deleted'

export type InstanceRow = {
  id: string
  status: InstanceStatus
  port: number | null
  pid: number | null
  profile_dir: string
  files_dir: string
}

export type Db = {
  insert(row: InstanceRow): void
  update(id: string, patch: Partial<Pick<InstanceRow, 'status' | 'port' | 'pid'>>): void
  get(id: string): InstanceRow | undefined
  list(): InstanceRow[]
  close(): void
}

function mapRow(row: Record<string, unknown> | undefined): InstanceRow | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    status: String(row.status) as InstanceStatus,
    port: row.port == null ? null : Number(row.port),
    pid: row.pid == null ? null : Number(row.pid),
    profile_dir: String(row.profile_dir),
    files_dir: String(row.files_dir),
  }
}

export function openDb(dbPath: string): Db {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const database = new DatabaseSync(dbPath)
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      port INTEGER,
      pid INTEGER,
      profile_dir TEXT NOT NULL,
      files_dir TEXT NOT NULL
    );
  `)
  const insert = database.prepare(`
    INSERT INTO instances (id, status, port, pid, profile_dir, files_dir)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const update = database.prepare(`
    UPDATE instances
    SET status = ?, port = ?, pid = ?
    WHERE id = ?
  `)
  const get = database.prepare(`SELECT id, status, port, pid, profile_dir, files_dir FROM instances WHERE id = ?`)
  const list = database.prepare(`SELECT id, status, port, pid, profile_dir, files_dir FROM instances ORDER BY id`)

  return {
    insert(row) {
      insert.run(row.id, row.status, row.port, row.pid, row.profile_dir, row.files_dir)
    },
    update(id, patch) {
      const current = mapRow(get.get(id) as Record<string, unknown> | undefined)
      if (!current) return
      update.run(
        patch.status ?? current.status,
        patch.port === undefined ? current.port : patch.port,
        patch.pid === undefined ? current.pid : patch.pid,
        id,
      )
    },
    get(id) {
      return mapRow(get.get(id) as Record<string, unknown> | undefined)
    },
    list() {
      return list.all().map((row) => mapRow(row as Record<string, unknown>)!)
    },
    close() {
      database.close()
    },
  }
}
