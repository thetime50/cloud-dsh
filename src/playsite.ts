import type { Config } from './config.ts'

export type AccessDecision = {
  ok: true
  userId: string
  llmKey: string
} | {
  ok: false
  status: number
}

export type InstanceListDecision = {
  ok: true
  userId: string
  instanceIds: string[]
} | {
  ok: false
  status: number
}

async function askPlaySite(config: Config, pathname: string, token: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(new URL(pathname, config.playSiteUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `play_site_token=${encodeURIComponent(token)}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.playSiteTimeoutMs),
    })
  } catch {
    return null
  }
}

function rejected(response: Response): AccessDecision | null {
  if (response.status === 401) return { ok: false, status: 401 }
  if (!response.ok) return { ok: false, status: 403 }
  return null
}

export async function listUserInstances(config: Config, token: string): Promise<InstanceListDecision> {
  const response = await askPlaySite(config, config.playSiteInstancesPath, token, {})
  if (!response) return { ok: false, status: 502 }
  const failed = rejected(response)
  if (failed) return failed
  const body = await response.json().catch(() => null) as { ok?: boolean, userId?: string, instanceIds?: unknown } | null
  if (!body?.ok || !Array.isArray(body.instanceIds)) return { ok: false, status: 403 }
  return {
    ok: true,
    userId: String(body.userId || ''),
    instanceIds: body.instanceIds.map((id) => String(id)),
  }
}

export async function confirmAccess(config: Config, instanceId: string, token: string): Promise<AccessDecision> {
  const response = await askPlaySite(config, config.playSiteAccessPath, token, { instanceId })
  if (!response) return { ok: false, status: 502 }
  const failed = rejected(response)
  if (failed) return failed
  const body = await response.json().catch(() => null) as { ok?: boolean, userId?: string, llmKey?: string } | null
  if (!body?.ok) return { ok: false, status: 403 }
  return {
    ok: true,
    userId: String(body.userId || ''),
    llmKey: body.llmKey ? String(body.llmKey) : '',
  }
}

export function readCookie(header: string | undefined, name: string): string {
  if (!header) return ''
  for (const part of header.split(';')) {
    const text = part.trim()
    const index = text.indexOf('=')
    if (index <= 0) continue
    if (text.slice(0, index) !== name) continue
    return decodeURIComponent(text.slice(index + 1))
  }
  return ''
}
