import path from 'node:path'

export type Config = {
  gatewayHost: string
  gatewayPort: number
  adminToken: string
  storageDir: string
  privateDir: string
  appsDir: string
  dbPath: string
  sandboxLog: string
  dshBin: string
  dshMode: 'dsh' | 'stub'
  sandboxPath: string
  runtimeDir: string
  uvBin: string
  playSiteUrl: string
  playSiteAccessPath: string
  playSiteTimeoutMs: number
  defaultLlmKey: string
  publicHost: string
  healthTimeoutMs: number
  sandboxBin: string
  stubExitAfterMs: number
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const storageDir = path.resolve(env.CLOUD_DSH_STORAGE || path.join('data', 'storage'))
  const privateDir = path.resolve(env.CLOUD_DSH_PRIVATE || path.join('data', 'private'))
  return {
    gatewayHost: env.CLOUD_DSH_GATEWAY_HOST || '127.0.0.1',
    gatewayPort: Number(env.CLOUD_DSH_GATEWAY_PORT || 8080),
    adminToken: env.CLOUD_DSH_ADMIN_TOKEN || '',
    storageDir,
    privateDir,
    appsDir: path.resolve(env.CLOUD_DSH_APPS || 'apps'),
    dbPath: path.resolve(env.CLOUD_DSH_DB || path.join(privateDir, 'infrastructure', 'control.db')),
    sandboxLog: path.resolve(env.CLOUD_DSH_SANDBOX_LOG || path.join(privateDir, 'infrastructure', 'sandbox.ndjson')),
    dshBin: env.CLOUD_DSH_DSH_BIN || 'dsh',
    dshMode: env.CLOUD_DSH_DSH_MODE === 'stub' ? 'stub' : 'dsh',
    sandboxPath: env.CLOUD_DSH_SANDBOX_PATH || env.PATH || '',
    runtimeDir: env.CLOUD_DSH_RUNTIME || '',
    uvBin: env.CLOUD_DSH_UV || 'uv',
    playSiteUrl: env.CLOUD_DSH_PLAY_SITE_URL || 'http://127.0.0.1:9',
    playSiteAccessPath: env.CLOUD_DSH_PLAY_SITE_ACCESS_PATH || '/api/internal/dsh/access',
    playSiteTimeoutMs: Number(env.CLOUD_DSH_PLAY_SITE_TIMEOUT_MS || 5000),
    defaultLlmKey: env.CLOUD_DSH_DEFAULT_LLM_KEY || '',
    publicHost: env.CLOUD_DSH_PUBLIC_HOST || 'dsh.xx.yy.com',
    healthTimeoutMs: Number(env.CLOUD_DSH_HEALTH_TIMEOUT_MS || 30000),
    sandboxBin: path.resolve(env.CLOUD_DSH_SANDBOX_BIN || path.join('src', 'sandbox-run.ts')),
    stubExitAfterMs: Number(env.CLOUD_DSH_STUB_EXIT_AFTER_MS || 0),
  }
}
