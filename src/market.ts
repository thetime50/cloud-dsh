import fs from 'node:fs'
import path from 'node:path'

export type MarketApp = {
  id: string
  name: string
  kind: string
  description: string
  dir: string
  packageName: string
}

function rank(id: string): number {
  if (id === 'base') return 0
  if (id === 'rag-blank') return 1
  return 2
}

export function listMarketApps(appsDir: string): MarketApp[] {
  if (!fs.existsSync(appsDir)) return []
  const apps: MarketApp[] = []
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(appsDir, entry.name)
    const metaPath = path.join(dir, 'app.json')
    const pkgPath = path.join(dir, 'package.json')
    if (!fs.existsSync(metaPath) || !fs.existsSync(pkgPath)) continue
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      id?: string
      name?: string
      kind?: string
      description?: string
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string }
    if (!meta.id || !meta.name || !pkg.name) continue
    apps.push({
      id: meta.id,
      name: meta.name,
      kind: meta.kind || '',
      description: meta.description || '',
      dir,
      packageName: pkg.name,
    })
  }
  apps.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
  return apps
}
