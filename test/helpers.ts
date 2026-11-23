import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadConfig, type Config } from '../src/config.ts'

export function tempConfig(patch: Partial<Config> = {}): Config {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-dsh-'))
  const config = loadConfig({
    ...process.env,
    CLOUD_DSH_STORAGE: path.join(root, 'storage'),
    CLOUD_DSH_PRIVATE: path.join(root, 'private'),
    CLOUD_DSH_APPS: path.resolve('apps'),
    CLOUD_DSH_DB: path.join(root, 'private', 'infrastructure', 'control.db'),
    CLOUD_DSH_SANDBOX_LOG: path.join(root, 'private', 'infrastructure', 'sandbox.ndjson'),
    CLOUD_DSH_DSH_BIN: path.resolve('test/stub-dsh.mjs'),
    CLOUD_DSH_DSH_MODE: 'stub',
    CLOUD_DSH_ADMIN_TOKEN: 'test-admin-token',
    CLOUD_DSH_DEFAULT_LLM_KEY: 'llm-test-key',
    CLOUD_DSH_HEALTH_TIMEOUT_MS: '8000',
    CLOUD_DSH_SANDBOX_BIN: path.resolve('src/sandbox-run.ts'),
    CLOUD_DSH_GATEWAY_PORT: '0',
    CLOUD_DSH_GATEWAY_HOST: '127.0.0.1',
    CLOUD_DSH_STUB_EXIT_AFTER_MS: '0',
    CLOUD_DSH_PLAY_SITE_URL: 'http://127.0.0.1:9',
  })
  return { ...config, ...patch }
}
